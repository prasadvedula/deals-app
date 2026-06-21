import React, { useState } from 'react';
import { Import, Link, FileInput, Plus, Upload, CheckCircle, XCircle, Loader2, ExternalLink } from 'lucide-react';
import { api } from '../api/client';
import { inr } from '../utils/currency';

type Tab = 'url' | 'manual' | 'bulk';

interface BulkProduct {
  name: string; description: string; category: string;
  price: string; original_price: string; platform: string;
}

interface ImportedProductPreview {
  name: string; description: string; category: string;
  price: number; original_price: number;
  image_url: string; platform: string; platform_url: string;
  product_id: number;
}

const PLATFORMS = [
  'Amazon India', 'Flipkart', 'Myntra', 'Meesho', 'Snapdeal',
  'Nykaa', 'Ajio', 'Tata CLiQ', 'External',
];

export default function ImportPage() {
  const [tab, setTab] = useState<Tab>('url');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [importedProduct, setImportedProduct] = useState<ImportedProductPreview | null>(null);

  // URL import
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState('Amazon India');

  // Manual import
  const [manual, setManual] = useState({
    name: '', description: '', category: 'Electronics',
    current_price: '', original_price: '', image_url: '',
    platform: 'External', platform_url: '',
  });

  // Bulk import
  const [bulkProducts, setBulkProducts] = useState<BulkProduct[]>([
    { name: '', description: '', category: 'Electronics', price: '', original_price: '', platform: 'External' },
  ]);

  const handleUrlImport = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setResult(null);
    setImportedProduct(null);
    try {
      const data = await api.importFromUrl(url.trim(), platform) as { success: boolean; product_id: number; product: ImportedProductPreview };
      setImportedProduct({ ...data.product, product_id: data.product_id });
      setResult({ success: true, message: `"${data.product.name}" imported successfully!` });
      setUrl('');
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : 'Import failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleManualImport = async () => {
    if (!manual.name || !manual.current_price) return;
    setLoading(true);
    setResult(null);
    try {
      await api.importManual({
        ...manual,
        current_price: parseFloat(manual.current_price),
        original_price: manual.original_price ? parseFloat(manual.original_price) : parseFloat(manual.current_price),
      });
      setResult({ success: true, message: 'Product added successfully!' });
      setManual({ name: '', description: '', category: 'Electronics', current_price: '', original_price: '', image_url: '', platform: 'External', platform_url: '' });
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : 'Import failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkImport = async () => {
    setLoading(true);
    setResult(null);
    try {
      const products = bulkProducts
        .filter((p) => p.name && p.price)
        .map((p) => ({
          name: p.name, description: p.description, category: p.category,
          price: parseFloat(p.price),
          original_price: p.original_price ? parseFloat(p.original_price) : parseFloat(p.price),
          platform: p.platform,
        }));

      const data = await api.importBulk(products) as { imported: number; failed: number };
      setResult({ success: true, message: `Imported ${data.imported} products (${data.failed} failed)` });
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : 'Import failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-6">
        <Import className="text-blue-600" size={22} />
        <h1 className="text-xl font-bold text-gray-800">Import Products</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6">
        {[
          { key: 'url' as Tab, icon: <Link size={16} />, label: 'From URL' },
          { key: 'manual' as Tab, icon: <Plus size={16} />, label: 'Manual Entry' },
          { key: 'bulk' as Tab, icon: <Upload size={16} />, label: 'Bulk Import' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setResult(null); setImportedProduct(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Result banner */}
      {result && (
        <div className={`flex items-center gap-2 p-3 rounded-xl mb-4 ${
          result.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {result.success ? <CheckCircle size={18} /> : <XCircle size={18} />}
          <span className="text-sm font-medium">{result.message}</span>
        </div>
      )}

      {/* Imported product preview */}
      {importedProduct && (
        <div className="bg-white border border-green-100 rounded-xl shadow-sm p-4 mb-6 flex gap-4">
          {importedProduct.image_url ? (
            <img
              src={importedProduct.image_url}
              alt={importedProduct.name}
              className="w-24 h-24 object-cover rounded-lg flex-shrink-0 bg-gray-50"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-24 h-24 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center text-gray-300 text-2xl">
              ?
            </div>
          )}
          <div className="flex-1 min-w-0">
            <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">
              {importedProduct.platform} · {importedProduct.category}
            </span>
            <h3 className="text-sm font-semibold text-gray-800 mt-1 line-clamp-2">{importedProduct.name}</h3>
            {importedProduct.description && (
              <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{importedProduct.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2">
              <span className="text-base font-bold text-gray-900">{inr(importedProduct.price)}</span>
              {importedProduct.original_price > importedProduct.price && (
                <>
                  <span className="text-xs text-gray-400 line-through">{inr(importedProduct.original_price)}</span>
                  <span className="text-xs text-green-600 font-semibold">
                    {Math.round(((importedProduct.original_price - importedProduct.price) / importedProduct.original_price) * 100)}% off
                  </span>
                </>
              )}
            </div>
            {importedProduct.platform_url && (
              <a
                href={importedProduct.platform_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 mt-1"
              >
                <ExternalLink size={12} /> View on {importedProduct.platform}
              </a>
            )}
          </div>
        </div>
      )}

      {/* URL Import */}
      {tab === 'url' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Import from E-commerce URL</h2>
          <p className="text-sm text-gray-500 mb-4">
            Paste a product URL from Amazon India, Flipkart, Myntra, Nykaa, or any Indian e-commerce site.
            Supports short links like <span className="font-mono text-xs bg-gray-100 px-1 rounded">amzn.in/d/...</span> too.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PLATFORMS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.amazon.com/dp/..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleUrlImport}
              disabled={loading || !url.trim()}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Import size={18} />}
              {loading ? 'Importing...' : 'Import Product'}
            </button>
          </div>
        </div>
      )}

      {/* Manual Entry */}
      {tab === 'manual' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Add Product Manually</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'name', label: 'Product Name *', type: 'text', full: true },
              { key: 'description', label: 'Description', type: 'text', full: true },
              { key: 'category', label: 'Category', type: 'select' },
              { key: 'platform', label: 'Platform', type: 'text' },
              { key: 'current_price', label: 'Current Price *', type: 'number' },
              { key: 'original_price', label: 'Original Price', type: 'number' },
              { key: 'image_url', label: 'Image URL', type: 'url', full: true },
              { key: 'platform_url', label: 'Product URL', type: 'url', full: true },
            ].map((field) => (
              <div key={field.key} className={field.full ? 'col-span-2' : ''}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                {field.type === 'select' ? (
                  <select
                    value={manual[field.key as keyof typeof manual]}
                    onChange={(e) => setManual((p) => ({ ...p, [field.key]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {['Electronics', 'Clothing', 'Kitchen', 'Home', 'Footwear', 'Health', 'General'].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type}
                    value={manual[field.key as keyof typeof manual]}
                    onChange={(e) => setManual((p) => ({ ...p, [field.key]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    step={field.type === 'number' ? '0.01' : undefined}
                    min={field.type === 'number' ? '0' : undefined}
                  />
                )}
              </div>
            ))}
          </div>
          <button
            onClick={handleManualImport}
            disabled={loading || !manual.name || !manual.current_price}
            className="mt-4 w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            {loading ? 'Adding...' : 'Add Product'}
          </button>
        </div>
      )}

      {/* Bulk Import */}
      {tab === 'bulk' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Bulk Import Products</h2>
          <p className="text-sm text-gray-500 mb-4">Add multiple products at once. Fill in required fields (Name, Price).</p>
          <div className="space-y-3 mb-4 max-h-80 overflow-y-auto">
            {bulkProducts.map((p, i) => (
              <div key={i} className="grid grid-cols-6 gap-2 p-3 bg-gray-50 rounded-lg">
                <input placeholder="Name *" value={p.name} onChange={(e) => setBulkProducts((prev) => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                  className="col-span-2 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                <input placeholder="Category" value={p.category} onChange={(e) => setBulkProducts((prev) => prev.map((x, j) => j === i ? { ...x, category: e.target.value } : x))}
                  className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                <input placeholder="Price *" type="number" value={p.price} onChange={(e) => setBulkProducts((prev) => prev.map((x, j) => j === i ? { ...x, price: e.target.value } : x))}
                  className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                <input placeholder="Orig. Price" type="number" value={p.original_price} onChange={(e) => setBulkProducts((prev) => prev.map((x, j) => j === i ? { ...x, original_price: e.target.value } : x))}
                  className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
                <button onClick={() => setBulkProducts((prev) => prev.filter((_, j) => j !== i))} disabled={bulkProducts.length === 1}
                  className="text-red-400 hover:text-red-600 disabled:opacity-30 text-xs">✕</button>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setBulkProducts((prev) => [...prev, { name: '', description: '', category: 'Electronics', price: '', original_price: '', platform: 'External' }])}
              className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <Plus size={16} /> Add Row
            </button>
            <button
              onClick={handleBulkImport}
              disabled={loading || !bulkProducts.some((p) => p.name && p.price)}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {loading ? 'Importing...' : `Import ${bulkProducts.filter((p) => p.name && p.price).length} Products`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
