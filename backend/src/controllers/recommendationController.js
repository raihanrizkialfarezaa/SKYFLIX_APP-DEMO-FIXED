const RecommendationService = require('../services/recommendationService');

const recommendationController = {
  // Get personalized recommendations
  async getPersonalizedRecommendations(req, res) {
    try {
      const userId = req.user._id;
      const recommendations = await RecommendationService.getPersonalizedRecommendations(userId);

      res.json({
        success: true,
        recommendations
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  // Get trending content
  async getTrendingContent(req, res) {
    try {
      // Using initiated cache
      const trending = Array.from(RecommendationService.trendingCache.values());
      
      res.json({
        success: true,
        trending,
        lastUpdated: RecommendationService.lastUpdate
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  // Get similar content
  async getSimilarContent(req, res) {
    try {
      const { filmId } = req.params;

      if (!filmId) {
        return res.status(400).json({
          success: false,
          message: 'Film ID is required'
        });
      }

      const result = await RecommendationService.getSimilarContent(filmId);

      if (!result.similar || result.similar.length === 0) {
        return res.json({
          success: true,
          message: 'No similar content found',
          similar: [],
          suggestions: [
            'Try searching with different criteria',
            'Check back later for new content',
          ]
        });
      }

      res.json({
        success: true,
        similar: result.similar,
        totalFound: result.similar.length,
        debug: process.env.NODE_ENV === 'development' ? result.debug : undefined
      });
    } catch (error) {
      console.error('Error getting similar content:', error);
      res.status(500).json({
        success: false,
        message: 'Error getting similar content',
        error: error.message
      });
    }
  },

  // Force refresh trending cache (admin only)
  async refreshTrendingCache(req, res) {
    try {
      await RecommendationService.refreshTrendingCache();
      res.json({
        success: true,
        message: 'Trending cache refreshed successfully',
        lastUpdated: RecommendationService.lastUpdate
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  // Get genre-based recommendations
  async getGenreRecommendations(req, res) {
    try {
      const { genreId } = req.params;
      const { limit = 10 } = req.query;

      if (!RecommendationService.genreStats) {
        await RecommendationService.initializeGenreRecommendations();
      }

      // Use genre stats to get recommendations
      const recommendations = await RecommendationService.getRecommendationsByGenre(genreId, parseInt(limit));

      res.json({
        success: true,
        recommendations
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
};

module.exports = recommendationController;