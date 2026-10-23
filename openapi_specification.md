openapi: 3.0.3
info:
  title: Checkout & Rewards System API
  version: 1.0.0
  description: >
    Production-grade API for an e-commerce platform supporting atomic checkout operations,
    idempotency controls, coupon application, and admin reporting.
servers:
  - url: http://localhost:3000
    description: Local Development Server

paths:
  /api/admin/inventory:
    get:
      summary: Get Product Inventory
      description: Fetches a list of all products in stock with their details.
      responses:
        '200':
          description: A list of products.
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Product'

  /api/cart/items:
    post:
      summary: Add Item to Cart
      description: >
        Adds an item to an existing cart or initializes a new cart if cartId is omitted or not found in DB.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - productId
                - quantity
              properties:
                cartId:
                  type: string
                  format: uuid
                  nullable: true
                  example: "c7f21228-5e45-42df-a0bd-3e4bfa3e82a3"
                productId:
                  type: integer
                  example: 1
                quantity:
                  type: integer
                  example: 2
      responses:
        '200':
          description: Item successfully added to cart.
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  cartId:
                    type: string
                    format: uuid
                  cart:
                    $ref: '#/components/schemas/Cart'
        '400':
          description: Bad request (e.g., requested quantity exceeds remaining inventory).
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '404':
          description: Product not found.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /api/cart/{cartId}:
    get:
      summary: Fetch Cart
      description: Retrieves the current contents, products, and computed subtotal for a given cart ID.
      parameters:
        - name: cartId
          in: path
          required: true
          schema:
            type: string
            format: uuid
          description: The unique identifier of the cart.
      responses:
        '200':
          description: Cart retrieved successfully.
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  cart:
                    $ref: '#/components/schemas/Cart'
        '404':
          description: Cart not found.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /api/carts/{cartId}/items/{itemId}:
    delete:
      summary: Remove Cart Item
      description: Removes a specific line item from the user's cart.
      parameters:
        - name: cartId
          in: path
          required: true
          schema:
            type: string
            format: uuid
        - name: itemId
          in: path
          required: true
          schema:
            type: integer
      responses:
        '200':
          description: Item successfully removed from cart.
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true

  /api/cart/apply-coupon:
    post:
      summary: Preview/Apply Coupon
      description: Calculates the total discount and adjusted total for a cart without redeeming the coupon.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - cartId
                - couponCode
              properties:
                cartId:
                  type: string
                  format: uuid
                couponCode:
                  type: string
                  example: "PROMO20"
      responses:
        '200':
          description: Coupon applied successfully and discount computed.
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  data:
                    type: object
                    properties:
                      couponCode:
                        type: string
                        example: "PROMO20"
                      discountPercent:
                        type: number
                        example: 20
                      subtotalCents:
                        type: integer
                        example: 10000
                      discountCents:
                        type: integer
                        example: 2000
                      totalCents:
                        type: integer
                        example: 8000
        '400':
          description: Invalid or already redeemed coupon, or empty cart.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /api/checkout:
    post:
      summary: Process Order Checkout
      description: >
        Executes an atomic checkout transaction. Redeems a coupon if provided, decrements inventory,
        creates the order, clears the cart, and caches the result under the Idempotency-Key.
      parameters:
        - name: Idempotency-Key
          in: header
          required: true
          schema:
            type: string
          description: Unique key to ensure request idempotency and prevent duplicate order processing.
          example: "req_xyz_12345"
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - cartId
              properties:
                cartId:
                  type: string
                  format: uuid
                couponCode:
                  type: string
                  nullable: true
                  example: "MILESTONE-5-X89A"
      responses:
        '201':
          description: Checkout successfully completed and order placed.
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  data:
                    $ref: '#/components/schemas/Order'
        '400':
          description: Bad request (e.g., missing Idempotency-Key, empty cart, insufficient inventory, or coupon invalid).
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /api/orders:
    get:
      summary: Fetch Placed Orders
      description: Returns a list of all historical placed orders sorted by creation date descending.
      responses:
        '200':
          description: A list of placed orders.
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  orders:
                    type: array
                    items:
                      $ref: '#/components/schemas/Order'

  /api/coupons/available:
    get:
      summary: Get Available Coupons
      description: Returns all coupons that are still available for redemption.
      responses:
        '200':
          description: List of available coupons.
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  coupons:
                    type: array
                    items:
                      $ref: '#/components/schemas/Coupon'

  /api/admin/coupons:
    post:
      summary: Create Custom Coupon
      description: Admin endpoint to create a custom discount coupon code.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - code
                - discountPercent
              properties:
                code:
                  type: string
                  example: "SUMMER15"
                discountPercent:
                  type: integer
                  minimum: 1
                  maximum: 100
                  example: 15
                usesRemaining:
                  type: integer
                  default: 1
                  example: 1
                expiresAt:
                  type: string
                  format: date-time
                  nullable: true
      responses:
        '201':
          description: Coupon created successfully.
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  coupon:
                    $ref: '#/components/schemas/Coupon'
        '400':
          description: Invalid input or coupon code already exists.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /api/admin/coupons/generate:
    post:
      summary: Trigger Milestone Coupon Generation
      description: Generates a milestone discount coupon manually if order threshold requirements are satisfied.
      responses:
        '201':
          description: Milestone coupon generated successfully.
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  message:
                    type: string
                    example: "Milestone coupon generated successfully"
                  coupon:
                    $ref: '#/components/schemas/Coupon'
        '400':
          description: Order milestone requirement not reached yet.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /api/admin/report:
    get:
      summary: Get Business Analytics Report
      description: Aggregates total sales, revenue stats, product quantities sold, and coupon utilization metrics.
      responses:
        '200':
          description: Sales and coupon performance report.
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    example: true
                  summary:
                    type: object
                    properties:
                      grossRevenueCents:
                        type: integer
                        example: 25000
                      totalDiscountsGrantedCents:
                        type: integer
                        example: 2500
                      netRevenueCents:
                        type: integer
                        example: 22500
                      totalSuccessfullyPlacedOrders:
                        type: integer
                        example: 5
                      coupons:
                        type: object
                        properties:
                          generated:
                            type: integer
                            example: 3
                          available:
                            type: integer
                            example: 2
                          redeemed:
                            type: integer
                            example: 1
                      purchasedQuantityByProduct:
                        type: object
                        additionalProperties:
                          type: object
                          properties:
                            productId:
                              type: integer
                            productName:
                              type: string
                            quantitySold:
                              type: integer
                            revenueCents:
                              type: integer

components:
  schemas:
    Product:
      type: object
      properties:
        id:
          type: integer
          example: 1
        name:
          type: string
          example: "Aerodynamic Helmet"
        unitPriceCents:
          type: integer
          example: 5000
        inventory:
          type: integer
          example: 10

    CartItem:
      type: object
      properties:
        id:
          type: integer
          example: 10
        cartId:
          type: string
          format: uuid
        productId:
          type: integer
          example: 1
        quantity:
          type: integer
          example: 2
        product:
          $ref: '#/components/schemas/Product'

    Cart:
      type: object
      properties:
        id:
          type: string
          format: uuid
        status:
          type: string
          example: "ACTIVE"
        subtotalCents:
          type: integer
          example: 10000
        items:
          type: array
          items:
            $ref: '#/components/schemas/CartItem'

    OrderItem:
      type: object
      properties:
        id:
          type: integer
          example: 101
        orderId:
          type: integer
          example: 5
        productId:
          type: integer
          example: 1
        quantity:
          type: integer
          example: 2
        unitPriceCents:
          type: integer
          example: 5000
        product:
          $ref: '#/components/schemas/Product'

    Order:
      type: object
      properties:
        id:
          type: integer
          example: 5
        subtotalCents:
          type: integer
          example: 10000
        discountCents:
          type: integer
          example: 1000
        totalCents:
          type: integer
          example: 9000
        couponCodeUsed:
          type: string
          nullable: true
          example: "MILESTONE-5-X89A"
        createdAt:
          type: string
          format: date-time
        items:
          type: array
          items:
            $ref: '#/components/schemas/OrderItem'

    Coupon:
      type: object
      properties:
        id:
          type: integer
          example: 1
        code:
          type: string
          example: "SAVE10"
        discountPercent:
          type: integer
          example: 10
        usesRemaining:
          type: integer
          example: 1
        status:
          type: string
          enum: [AVAILABLE, REDEEMED]
          example: "AVAILABLE"
        expiresAt:
          type: string
          format: date-time
          nullable: true

    ErrorResponse:
      type: object
      properties:
        success:
          type: boolean
          example: false
        error:
          type: string
          example: "Insufficient inventory for Aerodynamic Helmet."