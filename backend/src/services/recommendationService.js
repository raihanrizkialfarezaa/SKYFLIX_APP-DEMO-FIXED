const { getDB } = require('../config/database');
const { ObjectId } = require('mongodb');

class RecommendationService {
  constructor() {
    this.trendingCache = new Map();
    this.lastUpdate = null;
    this.genreStats = null;
    this.userInteractions = null;
  }

  // Initialize the database connection
  initialize() {
    this.db = getDB();
  }

  async initializeRecommendations() {
    try {
      console.log('Initializing recommendation system...');

      // Ensure database is initialized
      this.initialize();

      // Initialize trending content cache
      await this.refreshTrendingCache();

      // Initialize genre-based recommendations
      await this.initializeGenreRecommendations();

      // Initialize collaborative filtering data
      await this.initializeCollaborativeData();

      console.log('Recommendation system initialized successfully');
    } catch (error) {
      console.error('Error initializing recommendations:', error);
      throw error;
    }
  }

  // Ensure db is initialized before any database operation
  ensureDbConnection() {
    if (!this.db) {
      this.initialize();
    }
  }

  async refreshTrendingCache() {
    try {
      this.ensureDbConnection();

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const trendingContent = await this.db
        .collection('watchHistory')
        .aggregate([
          {
            $match: {
              watchDate: { $gte: thirtyDaysAgo },
            },
          },
          {
            $group: {
              _id: '$film.filmId',
              viewCount: { $sum: 1 },
              averageWatchDuration: { $avg: '$watchDuration' },
              completeViews: {
                $sum: { $cond: [{ $eq: ['$watchProgress', 100] }, 1, 0] },
              },
            },
          },
          {
            $lookup: {
              from: 'films',
              localField: '_id',
              foreignField: '_id',
              as: 'filmDetails',
            },
          },
          { $unwind: '$filmDetails' },
          {
            $project: {
              _id: 1,
              title: '$filmDetails.title',
              description: '$filmDetails.description',
              viewCount: 1,
              averageWatchDuration: 1,
              completionRate: { $divide: ['$completeViews', '$viewCount'] },
              score: {
                $add: [{ $multiply: ['$viewCount', 0.5] }, { $multiply: [{ $divide: ['$completeViews', '$viewCount'] }, 50] }],
              },
            },
          },
          { $sort: { score: -1 } },
          { $limit: 20 },
        ])
        .toArray();

      this.trendingCache.clear();
      trendingContent.forEach((item) => {
        this.trendingCache.set(item._id.toString(), item);
      });
      this.lastUpdate = new Date();

      console.log('Trending cache refreshed successfully');
    } catch (error) {
      console.error('Error refreshing trending cache:', error);
      throw error;
    }
  }

  async initializeGenreRecommendations() {
    try {
      this.ensureDbConnection();

      const genreStats = await this.db
        .collection('films')
        .aggregate([
          {
            $unwind: '$genres',
          },
          {
            $group: {
              _id: '$genres.genreId',
              genreName: { $first: '$genres.genreName' },
              filmCount: { $sum: 1 },
              totalViews: { $sum: '$viewCount' },
            },
          },
          {
            $project: {
              genreName: 1,
              filmCount: 1,
              totalViews: 1,
              popularityScore: {
                $divide: ['$totalViews', '$filmCount'],
              },
            },
          },
        ])
        .toArray();

      this.genreStats = genreStats.reduce((acc, genre) => {
        acc[genre._id.toString()] = genre;
        return acc;
      }, {});

      console.log('Genre recommendations initialized successfully');
    } catch (error) {
      console.error('Error initializing genre recommendations:', error);
      throw error;
    }
  }

  async initializeCollaborativeData() {
    try {
      this.ensureDbConnection();

      const recentInteractions = await this.db
        .collection('watchHistory')
        .aggregate([
          {
            $match: {
              watchDate: {
                $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              },
            },
          },
          {
            $group: {
              _id: '$userId',
              interactions: {
                $push: {
                  filmId: '$film.filmId',
                  rating: {
                    $cond: [{ $eq: ['$watchProgress', 100] }, 5, { $multiply: [{ $divide: ['$watchProgress', 100] }, 5] }],
                  },
                },
              },
            },
          },
        ])
        .toArray();

      this.userInteractions = recentInteractions.reduce((acc, user) => {
        acc[user._id.toString()] = user.interactions;
        return acc;
      }, {});

      console.log('Collaborative filtering data initialized successfully');
    } catch (error) {
      console.error('Error initializing collaborative data:', error);
      throw error;
    }
  }

  async getPersonalizedRecommendations(userId) {
    try {
      this.ensureDbConnection();

      const user = await this.db.collection('users').findOne({ _id: new ObjectId(userId) }, { projection: { preferences: 1 } });

      const watchHistory = await this.db
        .collection('watchHistory')
        .find({ userId: new ObjectId(userId) })
        .toArray();

      const preferredGenres = user.preferences.filter((pref) => pref.genreId).map((pref) => new ObjectId(pref.genreId));

      const preferredActors = user.preferences.filter((pref) => pref.actorId).map((pref) => new ObjectId(pref.actorId));

      const watchedFilmIds = watchHistory.map((h) => h.film.filmId);

      const recommendationQuery = {
        _id: { $nin: watchedFilmIds },
        $or: [{ 'genres.genreId': { $in: preferredGenres } }, { 'cast.actorId': { $in: preferredActors } }],
      };

      const recommendations = await this.db
        .collection('films')
        .aggregate([{ $match: recommendationQuery }, { $addFields: { score: { $rand: {} } } }, { $sort: { score: -1 } }, { $limit: 10 }])
        .toArray();

      return recommendations;
    } catch (error) {
      console.error('Error getting personalized recommendations:', error);
      throw error;
    }
  }

  async getTrendingContent() {
    try {
      this.ensureDbConnection();

      // Use cached trending content if available and recent
      if (this.trendingCache.size > 0 && this.lastUpdate) {
        const cacheAge = Date.now() - this.lastUpdate.getTime();
        if (cacheAge < 3600000) {
          // Cache valid for 1 hour
          return Array.from(this.trendingCache.values());
        }
      }

      // If cache is invalid or empty, refresh it
      await this.refreshTrendingCache();
      return Array.from(this.trendingCache.values());
    } catch (error) {
      console.error('Error getting trending content:', error);
      throw error;
    }
  }

  async getRecommendationsByGenre(genreId, limit = 10) {
    try {
      this.ensureDbConnection();

      if (!this.genreStats) {
        await this.initializeGenreRecommendations();
      }

      const recommendations = await this.db
        .collection('films')
        .aggregate([
          {
            $match: {
              'genres.genreId': new ObjectId(genreId),
            },
          },
          {
            $addFields: {
              popularityScore: {
                $multiply: ['$viewCount', { $ifNull: [{ $arrayElemAt: ['$ratings.internal', 0] }, 0] }],
              },
            },
          },
          { $sort: { popularityScore: -1 } },
          { $limit: limit },
        ])
        .toArray();

      return recommendations;
    } catch (error) {
      console.error('Error getting genre recommendations:', error);
      throw error;
    }
  }

  async getSimilarContent(filmId) {
    try {
      this.ensureDbConnection();

      const film = await this.db.collection('films').findOne({ 
        _id: new ObjectId(filmId) 
      });

      if (!film) {
        throw new Error('Film not found');
      }

      // Extract film attributes for comparison
      const genreIds = film.genres.map(g => g.genreId.toString());
      const releaseYear = film.releaseYear;
      const ageRating = film.ageRating;

      // Find similar films based on multiple criteria
      const similar = await this.db.collection('films')
        .aggregate([
          {
            $match: {
              _id: { $ne: new ObjectId(filmId) }, // Exclude current film
              $or: [
                // Match by genres
                { 'genres.genreId': { $in: film.genres.map(g => g.genreId) } },
                // Match by similar release year (±5 years)
                { 
                  releaseYear: { 
                    $gte: releaseYear - 5,
                    $lte: releaseYear + 5
                  } 
                },
                // Match by age rating
                { ageRating: ageRating }
              ]
            }
          },
          {
            $addFields: {
              // Calculate similarity score
              similarityScore: {
                $add: [
                  // Genre match score (up to 5 points)
                  {
                    $multiply: [
                      {
                        $size: {
                          $setIntersection: [
                            '$genres.genreId',
                            film.genres.map(g => g.genreId)
                          ]
                        }
                      },
                      5
                    ]
                  },
                  // Year proximity score (up to 3 points)
                  {
                    $subtract: [
                      3,
                      {
                        $abs: {
                          $divide: [
                            { $subtract: ['$releaseYear', releaseYear] },
                            2
                          ]
                        }
                      }
                    ]
                  },
                  // Rating match score (2 points)
                  {
                    $cond: [
                      { $eq: ['$ageRating', ageRating] },
                      2,
                      0
                    ]
                  },
                  // View count influence (up to 2 points)
                  {
                    $min: [
                      { $divide: ['$viewCount', 1000] },
                      2
                    ]
                  }
                ]
              }
            }
          },
          {
            $match: {
              similarityScore: { $gt: 0 } // Only include films with some similarity
            }
          },
          {
            $sort: {
              similarityScore: -1,
              viewCount: -1
            }
          },
          {
            $limit: 5
          },
          {
            $lookup: {
              from: 'studios',
              localField: 'studioId',
              foreignField: '_id',
              as: 'studio'
            }
          },
          {
            $unwind: {
              path: '$studio',
              preserveNullAndEmptyArrays: true
            }
          },
          {
            $project: {
              _id: 1,
              title: 1,
              description: 1,
              releaseYear: 1,
              ageRating: 1,
              genres: 1,
              viewCount: 1,
              studio: {
                _id: 1,
                studioName: 1
              },
              similarityScore: 1,
              similarityReasons: {
                $concat: [
                  // Explain why this film is similar
                  {
                    $cond: {
                      if: {
                        $gt: [
                          {
                            $size: {
                              $setIntersection: [
                                '$genres.genreId',
                                film.genres.map(g => g.genreId)
                              ]
                            }
                          },
                          0
                        ]
                      },
                      then: 'Similar genres, ',
                      else: ''
                    }
                  },
                  {
                    $cond: {
                      if: { $eq: ['$ageRating', ageRating] },
                      then: 'Same age rating, ',
                      else: ''
                    }
                  },
                  {
                    $cond: {
                      if: {
                        $and: [
                          { $gte: ['$releaseYear', releaseYear - 5] },
                          { $lte: ['$releaseYear', releaseYear + 5] }
                        ]
                      },
                      then: 'Released in similar period',
                      else: ''
                    }
                  }
                ]
              }
            }
          }
        ]).toArray();

      // Add debug information in development
      const debugInfo = process.env.NODE_ENV === 'development' ? {
        originalFilm: {
          genres: film.genres,
          releaseYear: film.releaseYear,
          ageRating: film.ageRating
        },
        totalSimilarFound: similar.length,
        searchCriteria: {
          genreIds,
          yearRange: `${releaseYear - 5} to ${releaseYear + 5}`,
          ageRating
        }
      } : null;

      return {
        similar,
        debug: debugInfo
      };
    } catch (error) {
      console.error('Error getting similar content:', error);
      throw error;
    }
  }
}

// Create and export a single instance
module.exports = new RecommendationService();
