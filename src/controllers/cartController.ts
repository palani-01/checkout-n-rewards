import { Request, Response, NextFunction } from 'express';
import { CartService } from '../services/cartService';

export class CartController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const cart = await CartService.createCart();
      res.status(201).json(cart);
    } catch (error) {
      next(error);
    }
  }

  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const cartSummary = await CartService.getCart(req.params.id);
      res.status(200).json(cartSummary);
    } catch (error) {
      next(error);
    }
  }

  static async addItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { productId, quantity } = req.body;
      const item = await CartService.addItem(req.params.id, Number(productId), Number(quantity));
      res.status(200).json({ message: 'Item added/updated successfully', item });
    } catch (error) {
      next(error);
    }
  }

  static async removeItem(req: Request, res: Response, next: NextFunction) {
    try {
      await CartService.removeItem(req.params.id, Number(req.params.productId));
      res.status(200).json({ message: 'Item removed from cart' });
    } catch (error) {
      next(error);
    }
  }
}