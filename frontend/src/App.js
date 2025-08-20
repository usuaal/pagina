import React, { useState, useEffect, useRef } from 'react';
import Quagga from 'quagga';
import JsBarcode from 'jsbarcode';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({});
  const [loading, setLoading] = useState(false);
  
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
  const [scannerType, setScannerType] = useState('manual'); // 'manual' or 'camera'
  const [manualBarcode, setManualBarcode] = useState('');
  const [generatedBarcode, setGeneratedBarcode] = useState('');
  const [barcodeFormat, setBarcodeFormat] = useState('CODE128');
  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const barcodeRef = useRef(null);
  
  const API_URL = process.env.REACT_APP_BACKEND_URL;

  // Load initial data
  useEffect(() => {
    loadProducts();
    loadMovements();
    loadDashboard();
  }, []);

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
      setProductForm({ ...productForm, barcode: data.barcode });
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

  const searchProductByBarcode = async (barcode) => {
    try {
      const response = await fetch(`${API_URL}/api/products/barcode/${barcode}`);
      if (response.ok) {
        const product = await response.json();
        setMovementForm({ ...movementForm, product_id: product.id, barcode_scanned: barcode });
        alert(`Producto encontrado: ${product.name}`);
      } else {
        alert('Producto no encontrado con ese código de barras');
      }
    } catch (error) {
      console.error('Error searching product:', error);
      alert('Error al buscar el producto');
    }
  };

  const handleManualBarcodeSubmit = () => {
    if (manualBarcode.trim()) {
      searchProductByBarcode(manualBarcode.trim());
      setManualBarcode('');
    }
  };

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

  const Navigation = () => (
    <nav className="bg-blue-900 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-2xl font-bold">Sistema de Inventario</h1>
        <div className="space-x-4">
          <button 
            onClick={() => setCurrentView('dashboard')}
            className={`px-4 py-2 rounded ${currentView === 'dashboard' ? 'bg-blue-700' : 'hover:bg-blue-800'}`}
          >
            Dashboard
          </button>
          <button 
            onClick={() => setCurrentView('products')}
            className={`px-4 py-2 rounded ${currentView === 'products' ? 'bg-blue-700' : 'hover:bg-blue-800'}`}
          >
            Productos
          </button>
          <button 
            onClick={() => setCurrentView('movements')}
            className={`px-4 py-2 rounded ${currentView === 'movements' ? 'bg-blue-700' : 'hover:bg-blue-800'}`}
          >
            Movimientos
          </button>
          <button 
            onClick={() => setCurrentView('scanner')}
            className={`px-4 py-2 rounded ${currentView === 'scanner' ? 'bg-blue-700' : 'hover:bg-blue-800'}`}
          >
            Escáner
          </button>
        </div>
      </div>
    </nav>
  );

  const Dashboard = () => (
    <div className="p-6">
      <h2 className="text-3xl font-bold mb-6 text-gray-800">Dashboard de Inventario</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-blue-100 p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-blue-800">Total Productos</h3>
          <p className="text-3xl font-bold text-blue-900">{dashboardStats.total_products || 0}</p>
        </div>
        
        <div className="bg-green-100 p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-green-800">Total Movimientos</h3>
          <p className="text-3xl font-bold text-green-900">{dashboardStats.total_movements || 0}</p>
        </div>
        
        <div className="bg-red-100 p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-red-800">Stock Bajo</h3>
          <p className="text-3xl font-bold text-red-900">{dashboardStats.low_stock_count || 0}</p>
        </div>
      </div>

      {dashboardStats.low_stock_products && dashboardStats.low_stock_products.length > 0 && (
        <div className="bg-yellow-50 p-6 rounded-lg shadow-md mb-6">
          <h3 className="text-lg font-semibold text-yellow-800 mb-3">Productos con Stock Bajo</h3>
          <ul className="space-y-2">
            {dashboardStats.low_stock_products.map((product, index) => (
              <li key={index} className="text-yellow-700">• {product}</li>
            ))}
          </ul>
        </div>
      )}

      {dashboardStats.recent_movements && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Movimientos Recientes</h3>
          <div className="space-y-3">
            {dashboardStats.recent_movements.map((movement, index) => (
              <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                <p className="font-medium">{movement.movement_type === 'entry' ? 'Entrada' : 'Salida'}</p>
                <p className="text-sm text-gray-600">
                  Piezas: {movement.quantity_pieces} | Pallets: {movement.quantity_pallets}
                </p>
                <p className="text-xs text-gray-500">{new Date(movement.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const ProductsView = () => (
    <div className="p-6">
      <h2 className="text-3xl font-bold mb-6 text-gray-800">Gestión de Productos</h2>
      
      {/* Add Product Form */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h3 className="text-xl font-semibold mb-4">Agregar Nuevo Producto</h3>
        <form onSubmit={createProduct} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Nombre del producto"
            value={productForm.name}
            onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
            className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          />
          
          <input
            type="text"
            placeholder="Descripción"
            value={productForm.description}
            onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
            className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="Código de barras"
              value={productForm.barcode}
              onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
              className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <select
              onChange={(e) => generateBarcode(e.target.value)}
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
            placeholder="Piezas por pallet (opcional)"
            value={productForm.pieces_per_pallet}
            onChange={(e) => setProductForm({ ...productForm, pieces_per_pallet: e.target.value })}
            className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          
          <input
            type="number"
            placeholder="Alerta de stock mínimo"
            value={productForm.min_stock_alert}
            onChange={(e) => setProductForm({ ...productForm, min_stock_alert: e.target.value })}
            className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          
          <input
            type="number"
            step="0.01"
            placeholder="Precio por pieza"
            value={productForm.price_per_piece}
            onChange={(e) => setProductForm({ ...productForm, price_per_piece: e.target.value })}
            className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          
          <input
            type="text"
            placeholder="Categoría"
            value={productForm.category}
            onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
            className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Creando...' : 'Crear Producto'}
            </button>
          </div>
        </form>
      </div>

      {/* Products List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <h3 className="text-xl font-semibold p-6 border-b">Lista de Productos</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock Piezas</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock Pallets</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium">{product.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{product.barcode}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{product.current_stock_pieces}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{product.current_stock_pallets}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{product.category}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      product.current_stock_pieces <= product.min_stock_alert 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {product.current_stock_pieces <= product.min_stock_alert ? 'Stock Bajo' : 'Normal'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const MovementsView = () => (
    <div className="p-6">
      <h2 className="text-3xl font-bold mb-6 text-gray-800">Movimientos de Inventario</h2>
      
      {/* Add Movement Form */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h3 className="text-xl font-semibold mb-4">Registrar Movimiento</h3>
        <form onSubmit={createMovement} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <select
            value={movementForm.product_id}
            onChange={(e) => setMovementForm({ ...movementForm, product_id: e.target.value })}
            className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Seleccionar producto</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} - {product.barcode}
              </option>
            ))}
          </select>
          
          <select
            value={movementForm.movement_type}
            onChange={(e) => setMovementForm({ ...movementForm, movement_type: e.target.value })}
            className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="entry">Entrada</option>
            <option value="exit">Salida</option>
          </select>
          
          <input
            type="number"
            placeholder="Cantidad en piezas"
            value={movementForm.quantity_pieces}
            onChange={(e) => setMovementForm({ ...movementForm, quantity_pieces: e.target.value })}
            className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          />
          
          <input
            type="number"
            placeholder="Cantidad en pallets"
            value={movementForm.quantity_pallets}
            onChange={(e) => setMovementForm({ ...movementForm, quantity_pallets: e.target.value })}
            className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          
          <input
            type="text"
            placeholder="Razón del movimiento"
            value={movementForm.movement_reason}
            onChange={(e) => setMovementForm({ ...movementForm, movement_reason: e.target.value })}
            className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          
          <input
            type="text"
            placeholder="Código escaneado (opcional)"
            value={movementForm.barcode_scanned}
            onChange={(e) => setMovementForm({ ...movementForm, barcode_scanned: e.target.value })}
            className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Registrando...' : 'Registrar Movimiento'}
            </button>
          </div>
        </form>
      </div>

      {/* Movements List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <h3 className="text-xl font-semibold p-6 border-b">Historial de Movimientos</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Piezas</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pallets</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Razón</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {movements.map((movement) => {
                const product = products.find(p => p.id === movement.product_id);
                return (
                  <tr key={movement.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {new Date(movement.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        movement.movement_type === 'entry' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {movement.movement_type === 'entry' ? 'Entrada' : 'Salida'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium">
                      {product ? product.name : 'Producto no encontrado'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{movement.quantity_pieces}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{movement.quantity_pallets}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {movement.movement_reason}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const ScannerView = () => (
    <div className="p-6">
      <h2 className="text-3xl font-bold mb-6 text-gray-800">Escáner de Códigos de Barras</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Manual Scanner */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold mb-4 flex items-center">
            <span className="mr-2">📝</span>
            Escáner Manual
          </h3>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Ingresa código de barras"
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleManualBarcodeSubmit()}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 text-lg"
            />
            <button
              onClick={handleManualBarcodeSubmit}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700"
            >
              Buscar Producto
            </button>
          </div>
        </div>

        {/* Camera Scanner (Placeholder) */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-xl font-semibold mb-4 flex items-center">
            <span className="mr-2">📷</span>
            Escáner con Cámara
          </h3>
          <div className="text-center">
            <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-8 mb-4">
              <p className="text-gray-500">Escáner con cámara será implementado próximamente</p>
              <p className="text-sm text-gray-400 mt-2">Requiere librerías de escáner adicionales</p>
            </div>
            <button
              className="bg-gray-400 text-white py-3 px-6 rounded-lg cursor-not-allowed"
              disabled
            >
              Activar Cámara (Próximamente)
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-semibold mb-4">Acciones Rápidas</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => setCurrentView('movements')}
            className="bg-green-600 text-white py-4 px-6 rounded-lg hover:bg-green-700 flex items-center justify-center"
          >
            <span className="mr-2">➕</span>
            Registrar Entrada
          </button>
          <button
            onClick={() => setCurrentView('movements')}
            className="bg-red-600 text-white py-4 px-6 rounded-lg hover:bg-red-700 flex items-center justify-center"
          >
            <span className="mr-2">➖</span>
            Registrar Salida
          </button>
          <button
            onClick={() => setCurrentView('products')}
            className="bg-blue-600 text-white py-4 px-6 rounded-lg hover:bg-blue-700 flex items-center justify-center"
          >
            <span className="mr-2">📦</span>
            Ver Productos
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="container mx-auto">
        {currentView === 'dashboard' && <Dashboard />}
        {currentView === 'products' && <ProductsView />}
        {currentView === 'movements' && <MovementsView />}
        {currentView === 'scanner' && <ScannerView />}
      </main>
    </div>
  );
}

export default App;