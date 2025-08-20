import React, { useState, useEffect, useRef, useCallback } from 'react';
import Quagga from 'quagga';
import JsBarcode from 'jsbarcode';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  
  // Product form states
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    barcode: '',
    pieces_per_pallet: '',
    min_stock_alert: '',
    price_per_piece: '',
    category: ''
  });
  
  // Movement form states
  const [movementForm, setMovementForm] = useState({
    product_id: '',
    movement_type: 'entry',
    quantity_pieces: '',
    quantity_pallets: '',
    movement_reason: '',
    barcode_scanned: ''
  });
  
  // Barcode scanner states
  const [scannerActive, setScannerActive] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [generatedBarcode, setGeneratedBarcode] = useState('');
  const [barcodeFormat, setBarcodeFormat] = useState('CODE128');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const scannerRef = useRef(null);
  const barcodeRef = useRef(null);
  
  const API_URL = process.env.REACT_APP_BACKEND_URL;

  // Load initial data
  useEffect(() => {
    loadProducts();
    loadMovements();
    loadDashboard();
  }, []);

  // Dark mode effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const loadProducts = async () => {
    try {
      const response = await fetch(`${API_URL}/api/products`);
      const data = await response.json();
      setProducts(data);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadMovements = async () => {
    try {
      const response = await fetch(`${API_URL}/api/movements`);
      const data = await response.json();
      setMovements(data);
    } catch (error) {
      console.error('Error loading movements:', error);
    }
  };

  const loadDashboard = async () => {
    try {
      const response = await fetch(`${API_URL}/api/dashboard`);
      const data = await response.json();
      setDashboardStats(data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  };

  const generateBarcode = async (format) => {
    try {
      const response = await fetch(`${API_URL}/api/generate-barcode/${format}`);
      const data = await response.json();
      setProductForm(prev => ({ ...prev, barcode: data.barcode }));
      setGeneratedBarcode(data.barcode);
      setBarcodeFormat(data.format);
    } catch (error) {
      console.error('Error generating barcode:', error);
    }
  };

  const createProduct = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...productForm,
          pieces_per_pallet: productForm.pieces_per_pallet ? parseInt(productForm.pieces_per_pallet) : null,
          min_stock_alert: parseInt(productForm.min_stock_alert || 0),
          price_per_piece: parseFloat(productForm.price_per_piece || 0),
          current_stock_pieces: 0,
          current_stock_pallets: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }),
      });
      
      if (response.ok) {
        setProductForm({
          name: '',
          description: '',
          barcode: '',
          pieces_per_pallet: '',
          min_stock_alert: '',
          price_per_piece: '',
          category: ''
        });
        loadProducts();
        alert('Producto creado exitosamente');
      }
    } catch (error) {
      console.error('Error creating product:', error);
      alert('Error al crear el producto');
    }
    setLoading(false);
  };

  const deleteProduct = async (productId, productName) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar el producto "${productName}"?`)) {
      try {
        const response = await fetch(`${API_URL}/api/products/${productId}`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          loadProducts();
          loadDashboard();
          alert('Producto eliminado exitosamente');
        } else {
          alert('Error al eliminar el producto');
        }
      } catch (error) {
        console.error('Error deleting product:', error);
        alert('Error al eliminar el producto');
      }
    }
  };

  const createMovement = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/movements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...movementForm,
          quantity_pieces: parseInt(movementForm.quantity_pieces || 0),
          quantity_pallets: parseInt(movementForm.quantity_pallets || 0),
        }),
      });
      
      if (response.ok) {
        setMovementForm({
          product_id: '',
          movement_type: 'entry',
          quantity_pieces: '',
          quantity_pallets: '',
          movement_reason: '',
          barcode_scanned: ''
        });
        setSelectedProduct(null);
        loadMovements();
        loadProducts();
        loadDashboard();
        alert('Movimiento registrado exitosamente');
      }
    } catch (error) {
      console.error('Error creating movement:', error);
      alert('Error al registrar el movimiento');
    }
    setLoading(false);
  };

  const searchProductByBarcode = useCallback(async (barcode) => {
    try {
      const response = await fetch(`${API_URL}/api/products/barcode/${barcode}`);
      if (response.ok) {
        const product = await response.json();
        setSelectedProduct(product);
        // Actualizar el formulario correctamente
        setMovementForm(prev => ({ 
          ...prev, 
          product_id: product.id, 
          barcode_scanned: barcode 
        }));
        alert(`Producto encontrado: ${product.name}`);
        return product;
      } else {
        alert('Producto no encontrado con ese código de barras');
        return null;
      }
    } catch (error) {
      console.error('Error searching product:', error);
      alert('Error al buscar el producto');
      return null;
    }
  }, [API_URL]);

  const handleManualBarcodeSubmit = useCallback(() => {
    if (manualBarcode.trim()) {
      searchProductByBarcode(manualBarcode.trim());
      setManualBarcode('');
    }
  }, [manualBarcode, searchProductByBarcode]);

  const startCameraScanner = () => {
    setScannerActive(true);
    setTimeout(() => {
      if (scannerRef.current) {
        Quagga.init({
          inputStream: {
            name: "Live",
            type: "LiveStream",
            target: scannerRef.current,
            constraints: {
              width: 480,
              height: 320,
              facingMode: "environment"
            }
          },
          locator: {
            patchSize: "medium",
            halfSample: true
          },
          numOfWorkers: 2,
          frequency: 10,
          decoder: {
            readers: [
              "code_128_reader",
              "ean_reader",
              "ean_8_reader",
              "code_39_reader"
            ]
          },
          locate: true
        }, (err) => {
          if (err) {
            console.error('Error starting scanner:', err);
            alert('Error al inicializar el escáner. Por favor verifica los permisos de cámara.');
            setScannerActive(false);
            return;
          }
          Quagga.start();
        });

        Quagga.onDetected((result) => {
          const code = result.codeResult.code;
          console.log('Barcode detected:', code);
          stopCameraScanner();
          searchProductByBarcode(code);
        });
      }
    }, 100);
  };

  const stopCameraScanner = () => {
    if (scannerActive) {
      Quagga.stop();
      setScannerActive(false);
    }
  };

  const generateBarcodeImage = (code, format) => {
    if (barcodeRef.current && code) {
      try {
        JsBarcode(barcodeRef.current, code, {
          format: format,
          width: 2,
          height: 100,
          displayValue: true,
          fontSize: 12,
          textMargin: 5
        });
      } catch (error) {
        console.error('Error generating barcode:', error);
      }
    }
  };

  useEffect(() => {
    if (generatedBarcode) {
      generateBarcodeImage(generatedBarcode, barcodeFormat);
    }
  }, [generatedBarcode, barcodeFormat]);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerActive) {
        stopCameraScanner();
      }
    };
  }, [scannerActive]);

  const printInventory = () => {
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Reporte de Inventario</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f3f4f6; }
            .summary { background-color: #f0f9ff; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <h1>Reporte de Inventario</h1>
          <p><strong>Fecha:</strong> ${new Date().toLocaleDateString()}</p>
          
          <div class="summary">
            <h3>Resumen</h3>
            <p><strong>Total de Productos:</strong> ${dashboardStats.total_products || 0}</p>
            <p><strong>Productos con Stock Bajo:</strong> ${dashboardStats.low_stock_count || 0}</p>
          </div>

          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Código de Barras</th>
                <th>Categoría</th>
                <th>Stock Piezas</th>
                <th>Stock Pallets</th>
                <th>Precio</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${products.map(product => `
                <tr>
                  <td>${product.name}</td>
                  <td>${product.barcode}</td>
                  <td>${product.category}</td>
                  <td>${product.current_stock_pieces}</td>
                  <td>${product.current_stock_pallets}</td>
                  <td>$${product.price_per_piece}</td>
                  <td>${product.current_stock_pieces <= product.min_stock_alert ? 'Stock Bajo' : 'Normal'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    
    const printWindow = window.open('', '', 'width=800,height=600');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  // Handle input changes properly to fix typing bug
  const handleProductFormChange = (field, value) => {
    setProductForm(prev => ({ ...prev, [field]: value }));
  };

  const handleMovementFormChange = (field, value) => {
    setMovementForm(prev => {
      const newForm = { ...prev, [field]: value };
      
      // Auto-calculate pieces when pallets change
      if (field === 'quantity_pallets') {
        const product = products.find(p => p.id === prev.product_id);
        if (product && product.pieces_per_pallet) {
          const pallets = parseInt(value) || 0;
          newForm.quantity_pieces = (pallets * product.pieces_per_pallet).toString();
        }
      }
      
      return newForm;
    });
  };

  const Navigation = () => (
    <nav className={`${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-sm border-b`}>
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center space-x-3">
            <img 
              src="https://images.unsplash.com/photo-1553413077-190dd305871c" 
              alt="Warehouse"
              className="w-8 h-8 rounded object-cover"
            />
            <div>
              <h1 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                Sistema de Inventario
              </h1>
            </div>
          </div>
          
          <div className="flex items-center space-x-6">
            {/* Navigation */}
            <div className="flex space-x-1">
              <button 
                onClick={() => setCurrentView('dashboard')}
                className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                  currentView === 'dashboard' 
                    ? 'bg-blue-100 text-blue-700' 
                    : (darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900')
                }`}
              >
                Dashboard
              </button>
              <button 
                onClick={() => setCurrentView('products')}
                className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                  currentView === 'products' 
                    ? 'bg-blue-100 text-blue-700'
                    : (darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900')
                }`}
              >
                Productos
              </button>
              <button 
                onClick={() => setCurrentView('movements')}
                className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                  currentView === 'movements' 
                    ? 'bg-blue-100 text-blue-700'
                    : (darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900')
                }`}
              >
                Movimientos
              </button>
              <button 
                onClick={() => setCurrentView('scanner')}
                className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                  currentView === 'scanner' 
                    ? 'bg-blue-100 text-blue-700'
                    : (darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900')
                }`}
              >
                Escáner
              </button>
            </div>
            
            {/* Dark mode toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg transition-colors ${
                darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );

  const Dashboard = () => (
    <div className={`p-6 min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h2 className={`text-2xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Dashboard
          </h2>
          <button
            onClick={printInventory}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
          >
            Imprimir Inventario
          </button>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} p-4 rounded-lg shadow-sm`}>
            <div className="text-sm text-gray-500 mb-1">Total Productos</div>
            <div className={`text-2xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {dashboardStats.total_products || 0}
            </div>
          </div>
          
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} p-4 rounded-lg shadow-sm`}>
            <div className="text-sm text-gray-500 mb-1">Movimientos</div>
            <div className={`text-2xl font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {dashboardStats.total_movements || 0}
            </div>
          </div>
          
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} p-4 rounded-lg shadow-sm`}>
            <div className="text-sm text-red-600 mb-1">Stock Bajo</div>
            <div className={`text-2xl font-semibold text-red-600`}>
              {dashboardStats.low_stock_count || 0}
            </div>
          </div>

          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} p-4 rounded-lg shadow-sm`}>
            <button
              onClick={() => setCurrentView('scanner')}
              className="w-full bg-blue-600 text-white py-2 rounded text-sm hover:bg-blue-700"
            >
              Escanear
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <button
            onClick={() => setCurrentView('scanner')}
            className={`${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-50'} p-4 rounded-lg shadow-sm text-left transition-colors`}
          >
            <div className="text-lg mb-2">📱</div>
            <div className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>Escanear</div>
            <div className="text-sm text-gray-500">Usar cámara o manual</div>
          </button>

          <button
            onClick={() => setCurrentView('products')}
            className={`${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-50'} p-4 rounded-lg shadow-sm text-left transition-colors`}
          >
            <div className="text-lg mb-2">➕</div>
            <div className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>Agregar Producto</div>
            <div className="text-sm text-gray-500">Crear nuevo</div>
          </button>

          <button
            onClick={() => setCurrentView('movements')}
            className={`${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-50'} p-4 rounded-lg shadow-sm text-left transition-colors`}
          >
            <div className="text-lg mb-2">📋</div>
            <div className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>Movimientos</div>
            <div className="text-sm text-gray-500">Ver historial</div>
          </button>
        </div>

        {/* Recent Activity */}
        {dashboardStats.recent_movements && (
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow-sm`}>
            <h3 className={`text-lg font-medium mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Movimientos Recientes
            </h3>
            <div className="space-y-3">
              {dashboardStats.recent_movements.map((movement, index) => (
                <div key={index} className={`p-3 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <div className="flex justify-between items-center">
                    <span className={`text-sm px-2 py-1 rounded ${
                      movement.movement_type === 'entry' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {movement.movement_type === 'entry' ? 'Entrada' : 'Salida'}
                    </span>
                    <span className="text-sm text-gray-500">
                      {new Date(movement.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm mt-1">
                    Piezas: {movement.quantity_pieces} | Pallets: {movement.quantity_pallets}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const ProductsView = () => (
    <div className={`p-6 min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-6xl mx-auto">
        <h2 className={`text-2xl font-semibold mb-8 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Productos
        </h2>
        
        {/* Add Product Form */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow-sm mb-8`}>
          <h3 className={`text-lg font-medium mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Nuevo Producto
          </h3>
          <form onSubmit={createProduct} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Nombre del producto"
              value={productForm.name}
              onChange={(e) => handleProductFormChange('name', e.target.value)}
              className={`p-3 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              required
            />
            
            <input
              type="text"
              placeholder="Descripción"
              value={productForm.description}
              onChange={(e) => handleProductFormChange('description', e.target.value)}
              className={`p-3 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            />
            
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="Código de barras"
                value={productForm.barcode}
                onChange={(e) => handleProductFormChange('barcode', e.target.value)}
                className={`flex-1 p-3 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              />
              <select
                onChange={(e) => e.target.value && generateBarcode(e.target.value)}
                className="px-4 py-3 border rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                <option value="">Generar</option>
                <option value="EAN13">EAN-13</option>
                <option value="UPC">UPC</option>
                <option value="CODE128">Code 128</option>
              </select>
            </div>
            
            <input
              type="number"
              placeholder="Piezas por pallet"
              value={productForm.pieces_per_pallet}
              onChange={(e) => handleProductFormChange('pieces_per_pallet', e.target.value)}
              className={`p-3 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            />
            
            <input
              type="number"
              placeholder="Stock mínimo"
              value={productForm.min_stock_alert}
              onChange={(e) => handleProductFormChange('min_stock_alert', e.target.value)}
              className={`p-3 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            />
            
            <input
              type="number"
              step="0.01"
              placeholder="Precio por pieza"
              value={productForm.price_per_piece}
              onChange={(e) => handleProductFormChange('price_per_piece', e.target.value)}
              className={`p-3 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            />
            
            <input
              type="text"
              placeholder="Categoría"
              value={productForm.category}
              onChange={(e) => handleProductFormChange('category', e.target.value)}
              className={`p-3 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            />
            
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={loading}
                className="bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Creando...' : 'Crear Producto'}
              </button>
            </div>
          </form>
        </div>

        {/* Products List */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-sm overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {products.map((product) => (
                  <tr key={product.id} className={`hover:${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <td className={`px-6 py-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                      <div className="font-medium">{product.name}</div>
                      <div className="text-sm text-gray-500">{product.category}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{product.barcode}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div>{product.current_stock_pieces} piezas</div>
                        <div>{product.current_stock_pallets} pallets</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => deleteProduct(product.id, product.name)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const MovementsView = () => (
    <div className={`p-6 min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-6xl mx-auto">
        <h2 className={`text-2xl font-semibold mb-8 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Movimientos
        </h2>
        
        {/* Movement Type Selection */}
        <div className="mb-6">
          <div className="flex space-x-2">
            <button
              onClick={() => handleMovementFormChange('movement_type', 'entry')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                movementForm.movement_type === 'entry'
                  ? 'bg-green-600 text-white'
                  : (darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700')
              }`}
            >
              Entrada
            </button>
            <button
              onClick={() => handleMovementFormChange('movement_type', 'exit')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                movementForm.movement_type === 'exit'
                  ? 'bg-red-600 text-white'
                  : (darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700')
              }`}
            >
              Salida
            </button>
          </div>
        </div>
        
        {/* Product Selection via Scanner */}
        {selectedProduct && (
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} p-4 rounded-lg mb-6 border-l-4 border-blue-500`}>
            <h4 className="font-medium text-blue-600">Producto Seleccionado:</h4>
            <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{selectedProduct.name}</p>
            <p className="text-sm text-gray-500">Código: {selectedProduct.barcode}</p>
            <p className="text-sm text-gray-500">
              Stock: {selectedProduct.current_stock_pieces} piezas, {selectedProduct.current_stock_pallets} pallets
            </p>
          </div>
        )}

        {/* Movement Form */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow-sm mb-8`}>
          <h3 className={`text-lg font-medium mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            {movementForm.movement_type === 'entry' ? 'Registrar Entrada' : 'Registrar Salida'}
          </h3>
          <form onSubmit={createMovement} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select
              value={movementForm.product_id}
              onChange={(e) => handleMovementFormChange('product_id', e.target.value)}
              className={`p-3 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              required
            >
              <option value="">Seleccionar producto</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} - {product.barcode}
                </option>
              ))}
            </select>
            
            <input
              type="number"
              placeholder="Número de pallets"
              value={movementForm.quantity_pallets}
              onChange={(e) => handleMovementFormChange('quantity_pallets', e.target.value)}
              className={`p-3 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              required
            />
            
            <input
              type="number"
              placeholder="Piezas (calculado automáticamente)"
              value={movementForm.quantity_pieces}
              onChange={(e) => handleMovementFormChange('quantity_pieces', e.target.value)}
              className={`p-3 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            />
            
            <input
              type="text"
              placeholder="Razón del movimiento"
              value={movementForm.movement_reason}
              onChange={(e) => handleMovementFormChange('movement_reason', e.target.value)}
              className={`p-3 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
            />
            
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setCurrentView('scanner')}
                className="bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700"
              >
                Escanear
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`flex-1 py-3 px-6 rounded-lg text-white disabled:opacity-50 ${
                  movementForm.movement_type === 'entry' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {loading ? 'Registrando...' : 'Registrar'}
              </button>
            </div>
          </form>
        </div>

        {/* Movements List */}
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-sm overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {movements.map((movement) => {
                  const product = products.find(p => p.id === movement.product_id);
                  return (
                    <tr key={movement.id} className={`hover:${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                      <td className="px-6 py-4 text-sm">
                        {new Date(movement.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded ${
                          movement.movement_type === 'entry' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {movement.movement_type === 'entry' ? 'Entrada' : 'Salida'}
                        </span>
                      </td>
                      <td className={`px-6 py-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                        {product ? product.name : 'Producto no encontrado'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div>{movement.quantity_pallets} pallets</div>
                        <div>{movement.quantity_pieces} piezas</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const ScannerView = () => (
    <div className={`p-6 min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-4xl mx-auto">
        <h2 className={`text-2xl font-semibold mb-8 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Escáner
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Manual Scanner */}
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow-sm`}>
            <h3 className={`text-lg font-medium mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Escáner Manual
            </h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Código de barras"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleManualBarcodeSubmit()}
                className={`w-full p-3 border rounded-lg ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              />
              <button
                onClick={handleManualBarcodeSubmit}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700"
              >
                Buscar Producto
              </button>
            </div>
          </div>

          {/* Camera Scanner */}
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow-sm`}>
            <h3 className={`text-lg font-medium mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Escáner con Cámara
            </h3>
            <div className="text-center">
              {!scannerActive ? (
                <>
                  <div className={`${darkMode ? 'bg-gray-700' : 'bg-gray-100'} border-2 border-dashed border-gray-300 rounded-lg p-8 mb-4`}>
                    <p className="text-gray-500">Usar cámara</p>
                  </div>
                  <button
                    onClick={startCameraScanner}
                    className="bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700"
                  >
                    Activar Cámara
                  </button>
                </>
              ) : (
                <>
                  <div 
                    ref={scannerRef} 
                    className="scanner-viewport bg-black rounded-lg mb-4 relative overflow-hidden"
                    style={{ height: '300px' }}
                  >
                    <div className="scanner-overlay"></div>
                  </div>
                  <button
                    onClick={stopCameraScanner}
                    className="bg-red-600 text-white py-3 px-6 rounded-lg hover:bg-red-700"
                  >
                    Detener
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Barcode Generator */}
        <div className={`mt-8 ${darkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow-sm`}>
          <h3 className={`text-lg font-medium mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Generador de Códigos
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex space-x-2 mb-4">
                <button
                  onClick={() => generateBarcode('EAN13')}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  EAN-13
                </button>
                <button
                  onClick={() => generateBarcode('UPC')}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  UPC
                </button>
                <button
                  onClick={() => generateBarcode('CODE128')}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Code 128
                </button>
              </div>
              {generatedBarcode && (
                <div className={`${darkMode ? 'bg-gray-700' : 'bg-gray-50'} p-4 rounded-lg`}>
                  <p className="text-sm text-gray-500 mb-2">Código:</p>
                  <p className="font-mono font-bold">{generatedBarcode}</p>
                </div>
              )}
            </div>
            <div>
              <div className={`barcode-container ${darkMode ? 'bg-gray-700' : 'bg-white'}`}>
                {generatedBarcode ? (
                  <>
                    <canvas ref={barcodeRef} className="mb-2"></canvas>
                    <button
                      onClick={() => window.print()}
                      className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm"
                    >
                      Imprimir
                    </button>
                  </>
                ) : (
                  <div className="h-32 flex items-center justify-center text-gray-400">
                    Genera un código
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen ${darkMode ? 'dark' : ''}`}>
      <Navigation />
      
      <main>
        {currentView === 'dashboard' && <Dashboard />}
        {currentView === 'products' && <ProductsView />}
        {currentView === 'movements' && <MovementsView />}
        {currentView === 'scanner' && <ScannerView />}
      </main>
    </div>
  );
}

export default App;