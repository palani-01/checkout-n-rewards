import React, { useState, useEffect } from 'react';
import { api } from './api';
import { 
  ShoppingOutlined, 
  ShoppingCartOutlined, 
  SafetyCertificateOutlined, 
  BarChartOutlined, 
  PlusOutlined, 
  DeleteOutlined, 
  ReloadOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { ConfigProvider, theme, Layout, Menu, Card, Button, Input, InputNumber, Table, Tag, Statistic, Row, Col, message } from 'antd';

const { Header, Content } = Layout;

export default function App() {
  const [currentTab, setCurrentTab] = useState('shop');
  const [products, setProducts] = useState([]);
  const [cartId, setCartId] = useState(localStorage.getItem('cartId') || null);
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Checkout state
  const [idempotencyKey, setIdempotencyKey] = useState(`key-${Date.now()}`);
  const [couponCode, setCouponCode] = useState('');
  const [checkoutResult, setCheckoutResult] = useState(null);

  // Admin state
  const [salesReport, setSalesReport] = useState(null);
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponDiscount, setNewCouponDiscount] = useState(10);

  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [orders, setOrders] = useState([]);

  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [discountCents, setDiscountCents] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);

  const subtotalCents = cart?.items?.reduce((sum, item) => sum + (item.product?.unitPriceCents * item.quantity), 0) || 0;
  const finalTotalCents = Math.max(0, subtotalCents - discountCents);

  const handleApplyCoupon = async () => {
    try {
      const currentCartId = localStorage.getItem('cartId');
      const data = await api.applyCoupon(currentCartId, couponInput);

      if (data.success) {
        setAppliedCoupon(data.data.couponCode);
        setDiscountCents(data.data.discountCents);
        setDiscountPercent(data.data.discountPercent);
        message.success(`Coupon applied! ${data.data.discountPercent}% off`);
      }
    } catch (err) {
      message.error(err.response?.data?.error || err.message || 'Invalid coupon');
      setAppliedCoupon(null);
      setDiscountCents(0);
    }
  };

  const formatCents = (cents) => `$${((cents || 0) / 100).toFixed(2)}`;

  useEffect(() => {
    loadProducts();
    if (cartId) fetchCart(cartId);
  }, [cartId]);

  const loadProducts = async () => {
    try {
      const data = await api.getProducts();
      const productList = Array.isArray(data) ? data : (data?.data || []);
      setProducts(productList);
    } catch (err) {
      console.error("Failed to load products", err);
      message.error("Could not fetch products from backend");
    }
  };

  const fetchCart = async (targetCartId) => {
    const idToFetch = targetCartId || localStorage.getItem('cartId');

    if (!idToFetch || idToFetch === 'undefined') {
      setCart(null);
      return; 
    }

    try {
      const data = await api.getCart(idToFetch);
      if (data.success && data.cart) {
        setCart(data.cart);
      }
    } catch (err) {
      console.error("Failed to load cart:", err);
    }
  };

  const loadAdminData = async () => {
    try {
      const data = await api.getAdminReport();
      if (data.success) {
        setSalesReport(data.summary);
      }
    } catch (err) {
      console.error("Failed to load admin report", err);
      message.error("Could not fetch admin analytics");
    }
  };

  const handleAddToCart = async (productId) => {
    let currentCartId = localStorage.getItem('cartId');

    try {
      const data = await api.addToCart(currentCartId, productId, 1);

      if (data.success) {
        localStorage.setItem('cartId', data.cartId);
        setCartId(data.cartId);
        setCart(data.cart);
        message.success('Item added to cart!');
      } else {
        message.error(data.error || 'Failed to add item');
      }
    } catch (err) {
      console.error("Add to cart error:", err);
      message.error('Network error adding to cart');
    }
  };

  const handleRemoveItem = async (itemId) => {
    try {
      setLoading(true);
      await api.removeCartItem(cartId, itemId);
      await fetchCart(cartId);
      message.success('Item removed');
    } catch (err) {
      message.error(err.response?.data?.message || err.message || 'Error removing item');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    try {
      setLoading(true);
      const uniqueIdempotencyKey = `checkout-${Date.now()}-${Math.random()}`;
      
      const res = await api.checkout(cartId, uniqueIdempotencyKey, couponCode);
      setCheckoutResult(res);
      message.success('Checkout successful! Order placed.');
      
      localStorage.removeItem('cartId');
      setCartId(null);
      setCart(null);
      setCouponCode('');

      await loadProducts();
    } catch (err) {
      console.error("Checkout error:", err);
      const serverMessage = err.response?.data?.message || err.message || 'Checkout failed';
      message.error(serverMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCoupon = async () => {
    if (!newCouponCode) {
      message.error("Please enter a coupon code");
      return;
    }
    try {
      const data = await api.createCoupon({
        code: newCouponCode.toUpperCase(),
        discountPercent: Number(newCouponDiscount),
        usesRemaining: 1
      });

      if (data.success || data.coupon) {
        message.success('Coupon created successfully!');
        setNewCouponCode('');
        loadAdminData();
      } else {
        message.error(data.error || 'Error creating coupon');
      }
    } catch (err) {
      console.error("Create coupon error:", err);
      message.error('Error creating coupon');
    }
  };

  const handleIncrement = async (item) => {
    try {
      setLoading(true);
      await api.addToCart(cartId, item.productId || item.product?.id, 1);
      await fetchCart(cartId);
      await loadProducts();
    } catch (err) {
      console.error("Failed to increment quantity:", err);
      message.error("Could not update quantity");
    } finally {
      setLoading(false);
    }
  };

  const handleDecrement = async (item) => {
    try {
      setLoading(true);
      const currentQty = item.quantity;
      const itemId = item.id;

      if (currentQty <= 1) {
        await api.removeCartItem(cartId, itemId);
        message.success('Item removed from cart');
      } else {
        await api.addToCart(cartId, item.productId || item.product?.id, -1);
      }

      await fetchCart(cartId);
      await loadProducts();
    } catch (err) {
      console.error("Failed to decrement quantity:", err);
      message.error("Could not update quantity");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentTab === 'admin') loadAdminData();
  }, [currentTab]);

  const fetchAvailableCoupons = async () => {
    try {
      const data = await api.getAvailableCoupons();
      if (data.success && Array.isArray(data.coupons)) {
        setAvailableCoupons(data.coupons);
      }
    } catch (err) {
      console.error("Failed to load available coupons:", err);
    }
  };

  useEffect(() => {
    if (currentTab === 'checkout') {
      fetchAvailableCoupons();
    }
  }, [currentTab]);

  const loadOrders = async () => {
    try {
      const data = await api.getOrders();
      if (data.success) {
        setOrders(data.orders);
      }
    } catch (err) {
      console.error("Failed to load order history", err);
    }
  };

  useEffect(() => {
    if (currentTab === 'orders') {
      loadOrders();
    }
  }, [currentTab]);

  return (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
      <Layout style={{ minHeight: '100vh', background: '#0f172a' }}>
        <Header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', borderBottom: '1px solid #334155' }}>
          <div style={{ color: '#f8fafc', fontWeight: 'bold', fontSize: '18px' }}>
            Checkout & Rewards Service
          </div>
          <Menu
            mode="horizontal"
            selectedKeys={[currentTab]}
            onClick={(e) => setCurrentTab(e.key)}
            style={{ background: 'transparent', borderBottom: 'none', minWidth: '400px' }}
            items={[
              { key: 'shop', icon: <ShoppingOutlined />, label: 'Storefront' },
              { key: 'checkout', icon: <SafetyCertificateOutlined />, label: 'Checkout' },
              { key: 'orders', icon: <HistoryOutlined />, label: 'Order History' },
              { key: 'admin', icon: <BarChartOutlined />, label: 'Admin Reports' },
            ]}
          />
        </Header>

        <Content style={{ padding: '24px 48px', maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
          {/* STOREFRONT TAB */}
          {currentTab === 'shop' && (
            <Row gutter={[24, 24]}>
              <Col xs={24} lg={16}>
                <h3 style={{ color: '#f8fafc', marginBottom: '16px' }}>Available Products</h3>
                <Row gutter={[16, 16]}>
                  {products.map((p) => (
                    <Col xs={24} sm={12} key={p.id}>
                      <Card 
                        style={{ background: '#1e293b', borderColor: '#334155' }}
                        actions={[
                          <Button 
                            type="primary" 
                            disabled={p.inventory === 0}
                            loading={loading}
                            onClick={() => handleAddToCart(p.id)}
                            icon={<PlusOutlined />}
                          >
                            Add to Cart
                          </Button>
                        ]}
                      >
                        <Card.Meta
                          title={<span style={{ color: '#f8fafc' }}>{p.name}</span>}
                          description={
                            <div>
                              <p style={{ color: '#94a3b8', fontSize: '12px', minHeight: '36px' }}>{p.description}</p>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                                <span style={{ color: '#34d399', fontWeight: 'bold', fontSize: '16px' }}>
                                  {formatCents(p.unitPriceCents)}
                                </span>
                                <Tag color={p.inventory > 0 ? 'processing' : 'error'}>
                                  Stock: {p.inventory}
                                </Tag>
                              </div>
                            </div>
                          }
                        />
                      </Card>
                    </Col>
                  ))}
                </Row>
              </Col>

              <Col xs={24} lg={8}>
                <Card 
                  title={<span style={{ color: '#f8fafc' }}><ShoppingCartOutlined /> Active Cart</span>}
                  style={{ background: '#1e293b', borderColor: '#334155', marginTop: '58px' }}
                >
                  {!cart || !cart.items || cart.items.length === 0 ? (
                    <p style={{ color: '#64748b', textAlign: 'center', padding: '24px 0' }}>Your cart is empty.</p>
                  ) : (
                    <div>
                      {cart.items.map((item) => {
                        const unitPrice = item.product?.unitPriceCents || 0;
                        return (
                          <div 
                            key={item.id} 
                            style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center', 
                              marginBottom: '16px', 
                            }}
                          >
                            <div style={{ flex: 1, paddingRight: '12px' }}>
                              <div style={{ color: '#f8fafc', fontWeight: 500, textAlign: 'left' }}>{item.product?.name}</div>
                              <div style={{ color: '#94a3b8', fontSize: '12px', textAlign: 'left' }}>{formatCents(unitPrice)} each</div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Button 
                                size="small"
                                loading={loading}
                                onClick={() => handleDecrement(item)}
                              >
                                -
                              </Button>
                              <span style={{ color: '#f8fafc', minWidth: '20px', textAlign: 'center', fontWeight: 'bold' }}>
                                {item.quantity}
                              </span>
                              <Button 
                                size="small" 
                                loading={loading}
                                onClick={() => handleIncrement(item)}
                              >
                                +
                              </Button>
                              <Button 
                                type="text" 
                                danger 
                                size="small"
                                icon={<DeleteOutlined />} 
                                onClick={() => handleRemoveItem(item.id)} 
                              />
                            </div>
                          </div>
                        );
                      })}

                      <div style={{ marginTop: '20px', paddingTop: '12px', borderTop: '1px solid #475569', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#94a3b8', fontWeight: 'bold' }}>Total Amount:</span>
                        <span style={{ color: '#34d399', fontSize: '18px', fontWeight: 'bold' }}>
                          {formatCents(cart.subtotalCents || 0)}
                        </span>
                      </div>

                      <Button 
                        type="primary" 
                        block 
                        size="large"
                        style={{ background: '#059669', marginTop: '16px', fontWeight: 'bold' }}
                        onClick={() => setCurrentTab('checkout')}
                      >
                        Proceed to Checkout
                      </Button>
                    </div>
                  )}
                </Card>
              </Col>
            </Row>
          )}

          {/* CHECKOUT TAB */}
          {currentTab === 'checkout' && (
            <Card style={{ background: '#1e293b', borderColor: '#334155', maxWidth: '600px', margin: '0 auto' }} title={<span style={{ color: '#f8fafc' }}>Review & Complete Checkout</span>}>
              
              <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #334155' }}>
                <h4 style={{ color: '#f8fafc', marginBottom: '12px' }}>Order Summary</h4>
                {!cart || !cart.items || cart.items.length === 0 ? (
                  <p style={{ color: '#64748b' }}>Your cart is empty. Please add items from the storefront.</p>
                ) : (
                  <div>
                    {cart.items.map((item) => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#94a3b8', fontSize: '14px' }}>
                        <span>{item.product?.name} (x{item.quantity})</span>
                        <span style={{ color: '#f8fafc' }}>{formatCents((item.product?.unitPriceCents || 0) * item.quantity)}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #334155', fontWeight: 'bold' }}>
                      <span style={{ color: '#f8fafc' }}>Total to Pay:</span>
                      <span style={{ color: '#34d399', fontSize: '16px' }}>{formatCents(cart.subtotalCents || 0)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '20px', padding: '12px', background: '#0f172a', borderRadius: '8px', border: '1px solid #334155' }}>
                <h5 style={{ color: '#f8fafc', marginBottom: '8px', fontSize: '13px' }}>Available Coupons</h5>
                {(!availableCoupons || availableCoupons.length === 0) ? (
                  <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>No active coupons available right now. Keep placing orders to unlock milestone rewards!</p>
                ) : (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {availableCoupons.map((c) => (
                      <Tag 
                        key={c.id || c.code} 
                        color="success" 
                        style={{ cursor: 'pointer', padding: '4px 8px' }}
                        onClick={() => setCouponCode(c.code)}
                      >
                        {c.code} ({c.discountPercent}% OFF) - Click to Apply
                      </Tag>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ color: '#94a3b8', display: 'block', marginBottom: '6px', fontSize: '12px' }}>PROMO CODE (OPTIONAL)</label>
                <Input 
                  placeholder="e.g. WELCOME10" 
                  style={{ background: '#0f172a', borderColor: '#334155', color: '#f8fafc', textTransform: 'uppercase' }}
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                />
              </div>

              <Button 
                type="primary" 
                block 
                size="large" 
                loading={loading}
                disabled={!cartId || !cart || !cart.items || cart.items.length === 0}
                onClick={handleCheckout}
              >
                Place Order
              </Button>
            </Card>
          )}

          {/* ADMIN TAB */}
          {currentTab === 'admin' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ color: '#f8fafc', margin: 0 }}>Business Analytics & Sales Report</h3>
                <Button icon={<ReloadOutlined />} onClick={loadAdminData}>Refresh Stats</Button>
              </div>

              {!salesReport ? (
                <Card style={{ background: '#1e293b', borderColor: '#334155', textAlign: 'center' }}>
                  <p style={{ color: '#94a3b8', margin: '24px 0' }}>Loading analytics or no reports available yet...</p>
                </Card>
              ) : (
                <>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Card style={{ background: '#1e293b', borderColor: '#334155' }}>
                        <Statistic title="Gross Revenue" value={formatCents(salesReport?.grossRevenueCents ?? 0)} valueStyle={{ color: '#34d399' }} />
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card style={{ background: '#1e293b', borderColor: '#334155' }}>
                        <Statistic title="Total Discounts Granted" value={formatCents(salesReport?.totalDiscountsGrantedCents ?? 0)} valueStyle={{ color: '#fbbf24' }} />
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card style={{ background: '#1e293b', borderColor: '#334155' }}>
                        <Statistic title="Net Revenue" value={formatCents(salesReport?.netRevenueCents ?? 0)} valueStyle={{ color: '#60a5fa' }} />
                      </Card>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Card style={{ background: '#1e293b', borderColor: '#334155' }}>
                        <Statistic title="Total Successfully Placed Orders" value={salesReport?.totalSuccessfullyPlacedOrders ?? 0} />
                      </Card>
                    </Col>
                    <Col span={12}>
                      <Card style={{ background: '#1e293b', borderColor: '#334155' }}>
                        <Statistic 
                          title="Coupons (Generated / Available / Redeemed)" 
                          value={`${salesReport?.coupons?.generated ?? 0} / ${salesReport?.coupons?.available ?? 0} / ${salesReport?.coupons?.redeemed ?? 0}`} 
                        />
                      </Card>
                    </Col>
                  </Row>

                  <Card title={<span style={{ color: '#f8fafc' }}>Purchased Quantity & Revenue by Product</span>} style={{ background: '#1e293b', borderColor: '#334155' }}>
                    <Table 
                      dataSource={Object.values(salesReport?.purchasedQuantityByProduct || {})}
                      rowKey="productId"
                      pagination={false}
                      locale={{ emptyText: <span style={{ color: '#94a3b8' }}>No product sales recorded yet.</span> }}
                      columns={[
                        {
                          title: 'Product Name',
                          dataIndex: 'productName',
                          key: 'productName',
                          render: (text) => <span style={{ color: '#f8fafc', fontWeight: 500 }}>{text}</span>
                        },
                        {
                          title: 'Quantity Sold',
                          dataIndex: 'quantitySold',
                          key: 'quantitySold',
                          render: (qty) => <Tag color="processing">{qty} units</Tag>
                        },
                        {
                          title: 'Total Sales Revenue',
                          dataIndex: 'revenueCents',
                          key: 'revenueCents',
                          render: (cents) => <span style={{ color: '#34d399', fontWeight: 'bold' }}>{formatCents(cents)}</span>
                        }
                      ]}
                    />
                  </Card>
                </>
              )}

              <Card title={<span style={{ color: '#f8fafc' }}>Coupon Administration</span>} style={{ background: '#1e293b', borderColor: '#334155' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  <div>
                    <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '6px' }}>CREATE CUSTOM PROMO CODE</label>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <Input 
                        placeholder="Coupon Code (e.g. SAVE20)" 
                        style={{ background: '#0f172a', borderColor: '#334155', color: '#f8fafc', textTransform: 'uppercase' }}
                        value={newCouponCode}
                        onChange={(e) => setNewCouponCode(e.target.value)}
                      />
                      <InputNumber 
                        min={1} 
                        max={100} 
                        placeholder="Discount %" 
                        style={{ width: '150px', background: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                        value={newCouponDiscount}
                        onChange={(val) => setNewCouponDiscount(val)}
                      />
                      <Button type="primary" onClick={handleCreateCoupon}>
                        Create Code
                      </Button>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px dashed #334155', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ color: '#f8fafc', fontWeight: 500, fontSize: '14px' }}>Order Milestone Reward Trigger</div>
                      <div style={{ color: '#94a3b8', fontSize: '12px' }}>Generates reward coupon if configured order milestone (nth order) is reached.</div>
                    </div>
                    <Button 
                      style={{ background: '#334155', borderColor: '#475569', color: '#f8fafc' }}
                      onClick={async () => {
                        try {
                          const data = await api.generateMilestoneCoupon();
                          if (data.success) {
                            message.success('Milestone coupon successfully generated!');
                            loadAdminData();
                          } else {
                            message.error(data.error || 'Milestone not reached yet.');
                          }
                        } catch (err) {
                          message.error('Failed to generate milestone coupon');
                        }
                      }}
                    >
                      Request Milestone Generation
                    </Button>
                  </div>

                </div>
              </Card>
            </div>
          )}

          {/* ORDER HISTORY TAB */}
          {currentTab === 'orders' && (
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
              <h2 style={{ color: '#f8fafc', marginBottom: '20px' }}>Completed Order History</h2>
              
              {orders.length === 0 ? (
                <Card style={{ background: '#1e293b', borderColor: '#334155', textAlign: 'center' }}>
                  <p style={{ color: '#94a3b8' }}>No orders placed yet. Complete a checkout from the storefront to see history!</p>
                </Card>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {orders.map((order) => (
                    <Card 
                      key={order.id} 
                      style={{ background: '#1e293b', borderColor: '#334155' }}
                      title={
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f8fafc', fontSize: '14px' }}>
                          <span>Order #{order.id}</span>
                          <span style={{ color: '#94a3b8', fontSize: '12px' }}>{new Date(order.createdAt).toLocaleString()}</span>
                        </div>
                      }
                    >
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '8px', textTransform: 'uppercase' }}>Items Purchased</div>
                        {order.items.map((item) => (
                          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #334155', fontSize: '13px', color: '#f8fafc' }}>
                            <span>{item.product?.name || 'Product'} × {item.quantity}</span>
                            <span style={{ color: '#34d399' }}>{formatCents(item.unitPriceCents * item.quantity)} ({formatCents(item.unitPriceCents)} each)</span>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '12px', fontSize: '13px', color: '#94a3b8' }}>
                        <div>
                          {order.couponCodeUsed && (
                            <span style={{ background: '#065f46', color: '#34d399', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', marginRight: '8px' }}>
                              Coupon: {order.couponCodeUsed} (-{formatCents(order.discountCents)})
                            </span>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div>Subtotal: {formatCents(order.subtotalCents)}</div>
                          <div style={{ color: '#f8fafc', fontWeight: 'bold', fontSize: '15px', marginTop: '4px' }}>
                            Total Paid: <span style={{ color: '#34d399' }}>{formatCents(order.totalCents)}</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </Content>
      </Layout>
    </ConfigProvider>
  );
}