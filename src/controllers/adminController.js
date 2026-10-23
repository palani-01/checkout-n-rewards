import { adminService } from '../services/adminService.js';

export const adminController = {
  async getSalesReport(req, res, next) {
    try {
      const report = await adminService.getSalesReport();
      res.status(200).json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  },

  async getInventoryReport(req, res, next) {
    try {
      const inventory = await adminService.getInventoryReport();
      res.status(200).json({ success: true, data: inventory });
    } catch (error) {
      next(error);
    }
  },

  async createCoupon(req, res, next) {
    try {
      const { code, discountPercent, milestoneOrderNumber } = req.body;
      const coupon = await adminService.createCoupon(code, discountPercent, milestoneOrderNumber);
      res.status(201).json({ success: true, data: coupon });
    } catch (error) {
      next(error);
    }
  },
};