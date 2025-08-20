#!/usr/bin/env python3
"""
Backend API Testing for Inventory Management System
Tests all backend endpoints for barcode inventory system
"""

import requests
import json
import sys
from datetime import datetime, timezone

# Backend URL from environment
BACKEND_URL = "https://barcode-tracker-4.preview.emergentagent.com/api"

class InventoryAPITester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.test_results = []
        self.created_products = []
        
    def log_result(self, test_name, success, message, details=None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = {
            "test": test_name,
            "status": status,
            "message": message,
            "details": details or {}
        }
        self.test_results.append(result)
        print(f"{status}: {test_name} - {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def test_health_check(self):
        """Test basic health endpoint"""
        try:
            response = requests.get(f"{self.base_url}/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                self.log_result("Health Check", True, f"API is healthy: {data.get('status')}")
                return True
            else:
                self.log_result("Health Check", False, f"Health check failed with status {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Health Check", False, f"Health check failed: {str(e)}")
            return False
    
    def test_barcode_generation(self):
        """Test barcode generation for different formats"""
        formats = ["EAN13", "UPC", "CODE128"]
        all_passed = True
        
        for format_type in formats:
            try:
                response = requests.get(f"{self.base_url}/generate-barcode/{format_type}", timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    barcode = data.get('barcode')
                    returned_format = data.get('format')
                    
                    # Validate barcode format
                    if format_type == "EAN13" and len(barcode) == 13 and barcode.isdigit():
                        self.log_result(f"Barcode Generation - {format_type}", True, 
                                      f"Generated valid EAN-13: {barcode}")
                    elif format_type == "UPC" and len(barcode) == 12 and barcode.isdigit():
                        self.log_result(f"Barcode Generation - {format_type}", True, 
                                      f"Generated valid UPC: {barcode}")
                    elif format_type == "CODE128" and barcode.startswith("INV") and len(barcode) == 13:
                        self.log_result(f"Barcode Generation - {format_type}", True, 
                                      f"Generated valid Code128: {barcode}")
                    else:
                        self.log_result(f"Barcode Generation - {format_type}", False, 
                                      f"Invalid barcode format: {barcode}")
                        all_passed = False
                else:
                    self.log_result(f"Barcode Generation - {format_type}", False, 
                                  f"Failed with status {response.status_code}")
                    all_passed = False
            except Exception as e:
                self.log_result(f"Barcode Generation - {format_type}", False, f"Error: {str(e)}")
                all_passed = False
        
        return all_passed
    
    def test_product_management(self):
        """Test complete product CRUD operations"""
        # Generate a barcode for testing
        try:
            barcode_response = requests.get(f"{self.base_url}/generate-barcode/EAN13", timeout=10)
            test_barcode = barcode_response.json()['barcode'] if barcode_response.status_code == 200 else "1234567890123"
        except:
            test_barcode = "1234567890123"
        
        # Test product creation
        product_data = {
            "name": "Laptop Dell Inspiron 15",
            "description": "Laptop empresarial con procesador Intel i7",
            "barcode": test_barcode,
            "pieces_per_pallet": 20,
            "current_stock_pieces": 50,
            "current_stock_pallets": 2,
            "min_stock_alert": 10,
            "price_per_piece": 899.99,
            "category": "Electrónicos",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        try:
            # CREATE product
            response = requests.post(f"{self.base_url}/products", 
                                   json=product_data, timeout=10)
            if response.status_code == 200:
                created_product = response.json()
                product_id = created_product['id']
                self.created_products.append(product_id)
                self.log_result("Product Creation", True, 
                              f"Created product: {created_product['name']} (ID: {product_id})")
                
                # READ product by ID
                get_response = requests.get(f"{self.base_url}/products/{product_id}", timeout=10)
                if get_response.status_code == 200:
                    retrieved_product = get_response.json()
                    self.log_result("Product Retrieval by ID", True, 
                                  f"Retrieved product: {retrieved_product['name']}")
                else:
                    self.log_result("Product Retrieval by ID", False, 
                                  f"Failed to retrieve product: {get_response.status_code}")
                
                # READ product by barcode
                barcode_response = requests.get(f"{self.base_url}/products/barcode/{test_barcode}", timeout=10)
                if barcode_response.status_code == 200:
                    barcode_product = barcode_response.json()
                    self.log_result("Product Search by Barcode", True, 
                                  f"Found product by barcode: {barcode_product['name']}")
                else:
                    self.log_result("Product Search by Barcode", False, 
                                  f"Failed to find product by barcode: {barcode_response.status_code}")
                
                # UPDATE product
                updated_data = created_product.copy()
                updated_data['name'] = "Laptop Dell Inspiron 15 - Actualizado"
                updated_data['current_stock_pieces'] = 75
                
                update_response = requests.put(f"{self.base_url}/products/{product_id}", 
                                             json=updated_data, timeout=10)
                if update_response.status_code == 200:
                    updated_product = update_response.json()
                    self.log_result("Product Update", True, 
                                  f"Updated product: {updated_product['name']}")
                else:
                    self.log_result("Product Update", False, 
                                  f"Failed to update product: {update_response.status_code}")
                
                return True
            else:
                self.log_result("Product Creation", False, 
                              f"Failed to create product: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Product Management", False, f"Error: {str(e)}")
            return False
    
    def test_inventory_movements(self):
        """Test inventory movement operations"""
        if not self.created_products:
            self.log_result("Inventory Movements", False, "No products available for testing movements")
            return False
        
        product_id = self.created_products[0]
        
        # Get initial stock
        try:
            product_response = requests.get(f"{self.base_url}/products/{product_id}", timeout=10)
            if product_response.status_code != 200:
                self.log_result("Inventory Movements", False, "Could not retrieve product for movement test")
                return False
            
            initial_product = product_response.json()
            initial_pieces = initial_product['current_stock_pieces']
            initial_pallets = initial_product['current_stock_pallets']
            
            # Test ENTRY movement
            entry_movement = {
                "product_id": product_id,
                "movement_type": "entry",
                "quantity_pieces": 25,
                "quantity_pallets": 1,
                "movement_reason": "Recepción de mercancía",
                "barcode_scanned": initial_product.get('barcode', ''),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "user": "Operador Almacén"
            }
            
            entry_response = requests.post(f"{self.base_url}/movements", 
                                         json=entry_movement, timeout=10)
            if entry_response.status_code == 200:
                self.log_result("Inventory Entry Movement", True, 
                              f"Registered entry: +25 pieces, +1 pallet")
                
                # Verify stock update
                updated_response = requests.get(f"{self.base_url}/products/{product_id}", timeout=10)
                if updated_response.status_code == 200:
                    updated_product = updated_response.json()
                    new_pieces = updated_product['current_stock_pieces']
                    new_pallets = updated_product['current_stock_pallets']
                    
                    if new_pieces == initial_pieces + 25 and new_pallets == initial_pallets + 1:
                        self.log_result("Stock Update - Entry", True, 
                                      f"Stock correctly updated: {new_pieces} pieces, {new_pallets} pallets")
                    else:
                        self.log_result("Stock Update - Entry", False, 
                                      f"Stock not updated correctly. Expected: {initial_pieces + 25} pieces, {initial_pallets + 1} pallets. Got: {new_pieces} pieces, {new_pallets} pallets")
                
            else:
                self.log_result("Inventory Entry Movement", False, 
                              f"Failed to register entry: {entry_response.status_code}")
                return False
            
            # Test EXIT movement
            exit_movement = {
                "product_id": product_id,
                "movement_type": "exit",
                "quantity_pieces": 10,
                "quantity_pallets": 0,
                "movement_reason": "Venta a cliente",
                "barcode_scanned": initial_product.get('barcode', ''),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "user": "Vendedor"
            }
            
            exit_response = requests.post(f"{self.base_url}/movements", 
                                        json=exit_movement, timeout=10)
            if exit_response.status_code == 200:
                self.log_result("Inventory Exit Movement", True, 
                              f"Registered exit: -10 pieces")
                
                # Verify stock update
                final_response = requests.get(f"{self.base_url}/products/{product_id}", timeout=10)
                if final_response.status_code == 200:
                    final_product = final_response.json()
                    final_pieces = final_product['current_stock_pieces']
                    expected_pieces = initial_pieces + 25 - 10
                    
                    if final_pieces == expected_pieces:
                        self.log_result("Stock Update - Exit", True, 
                                      f"Stock correctly updated after exit: {final_pieces} pieces")
                    else:
                        self.log_result("Stock Update - Exit", False, 
                                      f"Stock not updated correctly after exit. Expected: {expected_pieces}, Got: {final_pieces}")
            else:
                self.log_result("Inventory Exit Movement", False, 
                              f"Failed to register exit: {exit_response.status_code}")
                return False
            
            # Test movement history retrieval
            movements_response = requests.get(f"{self.base_url}/movements/{product_id}", timeout=10)
            if movements_response.status_code == 200:
                movements = movements_response.json()
                if len(movements) >= 2:
                    self.log_result("Movement History Retrieval", True, 
                                  f"Retrieved {len(movements)} movements for product")
                else:
                    self.log_result("Movement History Retrieval", False, 
                                  f"Expected at least 2 movements, got {len(movements)}")
            else:
                self.log_result("Movement History Retrieval", False, 
                              f"Failed to retrieve movements: {movements_response.status_code}")
            
            return True
            
        except Exception as e:
            self.log_result("Inventory Movements", False, f"Error: {str(e)}")
            return False
    
    def test_dashboard_statistics(self):
        """Test dashboard statistics endpoint"""
        try:
            response = requests.get(f"{self.base_url}/dashboard", timeout=10)
            if response.status_code == 200:
                stats = response.json()
                
                # Validate required fields
                required_fields = ['total_products', 'total_movements', 'low_stock_count', 
                                 'low_stock_products', 'recent_movements']
                
                missing_fields = [field for field in required_fields if field not in stats]
                if missing_fields:
                    self.log_result("Dashboard Statistics", False, 
                                  f"Missing fields: {missing_fields}")
                    return False
                
                # Validate data types
                if (isinstance(stats['total_products'], int) and 
                    isinstance(stats['total_movements'], int) and
                    isinstance(stats['low_stock_count'], int) and
                    isinstance(stats['low_stock_products'], list) and
                    isinstance(stats['recent_movements'], list)):
                    
                    self.log_result("Dashboard Statistics", True, 
                                  f"Dashboard stats: {stats['total_products']} products, "
                                  f"{stats['total_movements']} movements, "
                                  f"{stats['low_stock_count']} low stock alerts")
                    return True
                else:
                    self.log_result("Dashboard Statistics", False, 
                                  "Invalid data types in dashboard response")
                    return False
            else:
                self.log_result("Dashboard Statistics", False, 
                              f"Failed to get dashboard stats: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Dashboard Statistics", False, f"Error: {str(e)}")
            return False
    
    def test_product_listing(self):
        """Test product listing endpoint"""
        try:
            response = requests.get(f"{self.base_url}/products", timeout=10)
            if response.status_code == 200:
                products = response.json()
                if isinstance(products, list):
                    self.log_result("Product Listing", True, 
                                  f"Retrieved {len(products)} products")
                    return True
                else:
                    self.log_result("Product Listing", False, 
                                  "Products response is not a list")
                    return False
            else:
                self.log_result("Product Listing", False, 
                              f"Failed to get products: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Product Listing", False, f"Error: {str(e)}")
            return False
    
    def cleanup_test_data(self):
        """Clean up created test products"""
        for product_id in self.created_products:
            try:
                requests.delete(f"{self.base_url}/products/{product_id}", timeout=10)
                print(f"Cleaned up test product: {product_id}")
            except:
                print(f"Failed to cleanup product: {product_id}")
    
    def run_all_tests(self):
        """Run all backend tests"""
        print(f"🧪 Starting Backend API Tests for Inventory System")
        print(f"🔗 Backend URL: {self.base_url}")
        print("=" * 60)
        
        # Test sequence
        tests = [
            ("Health Check", self.test_health_check),
            ("Barcode Generation", self.test_barcode_generation),
            ("Product Listing", self.test_product_listing),
            ("Product Management", self.test_product_management),
            ("Inventory Movements", self.test_inventory_movements),
            ("Dashboard Statistics", self.test_dashboard_statistics)
        ]
        
        passed = 0
        total = len(tests)
        
        for test_name, test_func in tests:
            print(f"\n🔍 Running: {test_name}")
            try:
                if test_func():
                    passed += 1
            except Exception as e:
                self.log_result(test_name, False, f"Test execution error: {str(e)}")
        
        # Cleanup
        print(f"\n🧹 Cleaning up test data...")
        self.cleanup_test_data()
        
        # Summary
        print("\n" + "=" * 60)
        print(f"📊 TEST SUMMARY: {passed}/{total} tests passed")
        print("=" * 60)
        
        # Detailed results
        for result in self.test_results:
            print(f"{result['status']}: {result['test']} - {result['message']}")
        
        return passed == total

if __name__ == "__main__":
    tester = InventoryAPITester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)