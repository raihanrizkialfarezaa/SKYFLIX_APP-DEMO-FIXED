const { getDB } = require('../config/database');
const { ObjectId } = require('mongodb');

class SearchService {
  getDatabase() {
    return getDB();
  }

  async searchContent(query, filters = {}, options = {}) {
    try {
      const db = this.getDatabase();
      const {
        page = 1,
        limit = 10,
        sort = { createdAt: -1 }
      } = options;

      const skip = (page - 1) * limit;

      // Build search query
      const searchQuery = {};

      // Text search
      if (query && query.trim()) {
        searchQuery.$or = [
          { title: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } }
        ];
      }

      // Apply filters
      if (filters.genres && Array.isArray(filters.genres)) {
        searchQuery['genres.genreName'] = { 
          $in: filters.genres.map(genre => new RegExp(genre, 'i')) 
        };
      }

      if (filters.releaseYear) {
        searchQuery.releaseYear = parseInt(filters.releaseYear);
      }

      if (filters.ageRating) {
        searchQuery.ageRating = filters.ageRating;
      }

      // Execute search
      const results = await db.collection('films')
        .find(searchQuery)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .toArray();

      // Get total count
      const total = await db.collection('films')
        .countDocuments(searchQuery);

      return {
        success: true,
        results,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          hasMore: skip + results.length < total
        }
      };

    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }

  async getAdvancedFilters() {
    try {
      const db = this.getDatabase();
      
      // Get unique genres
      const films = await db.collection('films').find({}).toArray();
      const genres = [...new Set(films.flatMap(film => 
        film.genres?.map(g => g.genreName) || []
      ))];
      
      // Get unique release years
      const releaseYears = [...new Set(films
        .map(film => film.releaseYear)
        .filter(year => year)
      )].sort((a, b) => b - a);

      // Get unique age ratings
      const ageRatings = [...new Set(films
        .map(film => film.ageRating)
        .filter(rating => rating)
      )];

      return {
        success: true,
        filters: {
          genres,
          releaseYears,
          ageRatings
        }
      };
    } catch (error) {
      console.error('Error getting filters:', error);
      throw error;
    }
  }

  async getSuggestions(query) {
    try {
      if (!query || query.length < 2) {
        return { success: true, suggestions: [] };
      }

      const db = this.getDatabase();
      const films = await db.collection('films')
        .find(
          { title: { $regex: query, $options: 'i' } },
          { projection: { title: 1, releaseYear: 1 } }
        )
        .limit(5)
        .toArray();

      return {
        success: true,
        suggestions: films.map(film => ({
          id: film._id,
          title: film.title,
          year: film.releaseYear,
          type: 'film'
        }))
      };
    } catch (error) {
      console.error('Error getting suggestions:', error);
      throw error;
    }
  }
}

module.exports = new SearchService();