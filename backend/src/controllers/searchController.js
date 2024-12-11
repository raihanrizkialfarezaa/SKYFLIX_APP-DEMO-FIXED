const SearchService = require('../services/searchService');

const searchController = {
  async searchContent(req, res) {
    try {
      const { query, filters: filtersString, page = 1, limit = 10, sort: sortString } = req.query;

      // Parse filters if exists
      let filters = {};
      if (filtersString) {
        try {
          filters = JSON.parse(filtersString);
        } catch (e) {
          return res.status(400).json({ 
            success: false, 
            message: 'Invalid filters format' 
          });
        }
      }

      // Parse sort if exists
      let sort = { createdAt: -1 };
      if (sortString) {
        try {
          sort = JSON.parse(sortString);
        } catch (e) {
          return res.status(400).json({ 
            success: false, 
            message: 'Invalid sort format' 
          });
        }
      }

      const results = await SearchService.searchContent(
        query,
        filters,
        {
          page: parseInt(page),
          limit: parseInt(limit),
          sort
        }
      );

      res.json(results);
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  },

  async getFilters(req, res) {
    try {
      const filters = await SearchService.getAdvancedFilters();
      res.json(filters);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  },

  async getSuggestions(req, res) {
    try {
      const { query } = req.query;
      const suggestions = await SearchService.getSuggestions(query);
      res.json(suggestions);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  }
};

module.exports = searchController;