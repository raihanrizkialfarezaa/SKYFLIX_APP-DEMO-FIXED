const { getDB } = require('../config/database');
const { ObjectId } = require('mongodb');

const watchlistController = {
  // Add film to watchlist
  async addToWatchlist(req, res) {
    try {
      const db = getDB();
      const userId = req.user._id;
      const film = req.film; // From middleware
      const { priority, notes } = req.body;

      // Check if film already in watchlist
      const existingEntry = await db.collection('watchlist').findOne({
        userId: new ObjectId(userId),
        'films.filmId': film._id,
      });

      if (existingEntry) {
        return res.status(400).json({
          message: 'Film already in watchlist',
        });
      }

      const watchlistItem = {
        filmId: film._id,
        title: film.title, // Store title for easier reference
        dateAdded: new Date(),
        priority: parseInt(priority) || 1,
        notes,
        addedFrom: 'user_action',
        reminders: {
          enabled: false,
          frequency: null,
        },
      };

      const result = await db.collection('watchlist').updateOne(
        { userId: new ObjectId(userId) },
        {
          $push: { films: watchlistItem },
          $set: { lastUpdated: new Date() },
        },
        { upsert: true }
      );

      res.json({
        message: 'Film added to watchlist',
        watchlistItem: {
          ...watchlistItem,
          filmDetails: {
            title: film.title,
            releaseYear: film.releaseYear,
            duration: film.duration,
          },
        },
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Get user's watchlist
  async getWatchlist(req, res) {
    try {
      const db = getDB();
      const userId = req.user._id;

      const watchlist = await db
        .collection('watchlist')
        .aggregate([
          // Match user's watchlist
          {
            $match: {
              userId: new ObjectId(userId),
            },
          },
          // Lookup user details
          {
            $lookup: {
              from: 'users',
              localField: 'userId',
              foreignField: '_id',
              as: 'userDetails',
            },
          },
          // Unwind user details array
          {
            $unwind: '$userDetails',
          },
          // Lookup film details
          {
            $lookup: {
              from: 'films',
              localField: 'films.filmId',
              foreignField: '_id',
              as: 'filmDetails',
            },
          },
          // Lookup studio details for each film
          {
            $lookup: {
              from: 'studios',
              let: {
                studioIds: '$filmDetails.studioId',
              },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $in: ['$_id', '$$studioIds'],
                    },
                  },
                },
              ],
              as: 'studioDetails',
            },
          },
          // Project final structure
          {
            $project: {
              _id: 1,
              userId: 1,
              userDetails: {
                username: '$userDetails.username',
                fullName: '$userDetails.fullName',
              },
              films: 1,
              lastUpdated: 1,
              filmDetails: {
                $map: {
                  input: '$filmDetails',
                  as: 'film',
                  in: {
                    _id: '$$film._id',
                    studioId: '$$film.studioId',
                    studioDetails: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: '$studioDetails',
                            as: 'studio',
                            cond: {
                              $eq: ['$$studio._id', '$$film.studioId'],
                            },
                          },
                        },
                        0,
                      ],
                    },
                    title: '$$film.title',
                    releaseYear: '$$film.releaseYear',
                    duration: '$$film.duration',
                    description: '$$film.description',
                    ageRating: '$$film.ageRating',
                    viewCount: '$$film.viewCount',
                    createdAt: '$$film.createdAt',
                    directors: '$$film.directors',
                    genres: '$$film.genres',
                    cast: '$$film.cast',
                    technicalSpecs: '$$film.technicalSpecs',
                    ratings: '$$film.ratings',
                    streamingQuality: '$$film.streamingQuality',
                    availability: '$$film.availability',
                  },
                },
              },
            },
          },
        ])
        .toArray();

      if (!watchlist.length) {
        return res.status(404).json({ message: 'Watchlist not found' });
      }

      res.json(watchlist[0]);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Remove film from watchlist
  async removeFromWatchlist(req, res) {
    try {
      const db = getDB();
      const userId = req.user._id;
      const { filmId } = req.params;

      await db.collection('watchlist').updateOne(
        { userId: new ObjectId(userId) },
        {
          $pull: { films: { filmId: new ObjectId(filmId) } },
          $set: { lastUpdated: new Date() },
        }
      );

      res.json({ message: 'Film removed from watchlist' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
};

module.exports = watchlistController;
