const ReportingService = require('../services/reportingService');

const reportingController = {
  // Get user engagement report
  async getUserEngagementReport(req, res) {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({
          message: 'Both startDate and endDate are required'
        });
      }

      const report = await ReportingService.generateUserEngagementReport(
        startDate,
        endDate
      );
      res.json(report);
    } catch (error) {
      console.error('User engagement report error:', error);
      res.status(500).json({ 
        message: error.message,
        details: 'Error generating user engagement report'
      });
    }
  },

  // Get content performance report
  async getContentPerformanceReport(req, res) {
    try {
      const { period = 'month' } = req.query;
      
      if (!['week', 'month', 'year'].includes(period)) {
        return res.status(400).json({
          message: 'Invalid period. Must be one of: week, month, year'
        });
      }

      const report = await ReportingService.generateContentPerformanceReport(period);
      res.json(report);
    } catch (error) {
      console.error('Content performance report error:', error);
      res.status(500).json({ 
        message: error.message,
        details: 'Error generating content performance report'
      });
    }
  },

  // Get revenue report
  async getRevenueReport(req, res) {
    try {
      const { period = 'monthly' } = req.query;
      
      if (!['daily', 'monthly'].includes(period)) {
        return res.status(400).json({
          message: 'Invalid period. Must be either daily or monthly'
        });
      }

      const report = await ReportingService.generateRevenueReport(period);
      res.json(report);
    } catch (error) {
      console.error('Revenue report error:', error);
      res.status(500).json({ 
        message: error.message,
        details: 'Error generating revenue report'
      });
    }
  },

  // Get system health report
  async getSystemHealthReport(req, res) {
    try {
      const report = await ReportingService.generateSystemHealthReport();
      res.json(report);
    } catch (error) {
      console.error('System health report error:', error);
      res.status(500).json({ 
        message: error.message,
        details: 'Error generating system health report'
      });
    }
  }
};

module.exports = reportingController;