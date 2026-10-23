import axios from 'axios';

// Using relative path so Vite proxy handles the localhost:3000 forwarding
const API_BASE = '/api';

export const api = {
  // Products & Inventory
  getProducts: () => axios.get(`${API_BASE}/admin/inventory`).then(res => res.data),

  // Cart Management
  getCart: (cartId) => axios.get(`${API_BASE}/cart/${cartId}`).then(res => res.data),
  addToCart: (cartId, productId, quantity) => 
    axios.post(`${API_BASE}/cart/items`, { cartId, productId, quantity }).then(res => res.data),
  removeCartItem: (cartId, itemId) => 
    axios.delete(`${API_BASE}/carts/${cartId}/items/${itemId}`).then(res => res.data),
  updateCartItem: (cartId, productId, quantity) => 
    axios.put(`${API_BASE}/cart/items`, { cartId, productId, quantity }).then(res => res.data),

  // Checkout & Coupons
  applyCoupon: (cartId, couponCode) => 
    axios.post(`${API_BASE}/cart/apply-coupon`, { cartId, couponCode }).then(res => res.data),
  getAvailableCoupons: () => axios.get(`${API_BASE}/coupons/available`).then(res => res.data),
  checkout: (cartId, idempotencyKey, couponCode) => 
    axios.post(`${API_BASE}/checkout`, 
      { cartId, couponCode: couponCode || null },
      { headers: { 'idempotency-key': idempotencyKey } }
    ).then(res => res.data),

  // Orders
  getOrders: () => axios.get(`${API_BASE}/orders`).then(res => res.data),

  // Admin Reports & Operations
  getAdminReport: () => axios.get(`${API_BASE}/admin/report`).then(res => res.data),
  createCoupon: (couponData) => 
    axios.post(`${API_BASE}/admin/coupons`, couponData).then(res => res.data),
  generateMilestoneCoupon: () => 
    axios.post(`${API_BASE}/admin/coupons/generate`).then(res => res.data),
};