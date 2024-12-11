const { getDB } = require('../config/database');
const { ObjectId } = require('mongodb');
const cloudinary = require('../config/cloudinary');

const filmController = {
  // Upload film
  async uploadFilm(req, res) {
    try {
      const db = getDB();
      const { 
        title, 
        description, 
        releaseYear, 
        duration, 
        ageRating, 
        studioId, 
        directors, 
        genres, 
        cast 
      } = req.body;

      // Validate required fields
      if (!title || !description || !releaseYear || !duration || !ageRating || !studioId) {
        return res.status(400).json({ 
          message: 'Missing required fields',
          required: ['title', 'description', 'releaseYear', 'duration', 'ageRating', 'studioId']
        });
      }

      // Check if studio exists
      const studioExists = await db.collection('studios').findOne({ 
        _id: new ObjectId(studioId) 
      });

      if (!studioExists) {
        return res.status(404).json({ message: 'Studio not found' });
      }

      // Check if film with same title exists
      const existingFilm = await db.collection('films').findOne({ 
        title: { $regex: new RegExp(`^${title}$`, 'i') } 
      });

      if (existingFilm) {
        return res.status(400).json({ message: 'Film with this title already exists' });
      }

      // Ensure 'directors', 'genres', dan 'cast' is array
      const directorsArray = Array.isArray(directors) ? directors : JSON.parse(directors);
      const genresArray = Array.isArray(genres) ? genres : JSON.parse(genres);
      const castArray = Array.isArray(cast) ? cast : JSON.parse(cast);

      // Upload video to Cloudinary
      const result = await cloudinary.uploader.upload(req.file.path, {
        resource_type: 'video',
        folder: 'skyflix/films',
        eager: [
          { streaming_profile: 'hd' },
          { streaming_profile: 'sd' },
        ],
        eager_async: true,
      });

      const film = {
        studioId: new ObjectId(studioId),
        title,
        releaseYear: parseInt(releaseYear),
        duration: parseInt(duration),
        description,
        ageRating,
        viewCount: 0,
        createdAt: new Date(),
        uploadedBy: {
          userId: new ObjectId(req.user._id),
          userName: req.user.username,
          role: req.user.role
        },
        directors: directorsArray.map((dir) => ({
          directorId: new ObjectId(dir.directorId),
          directorName: dir.directorName,
        })),
        genres: genresArray.map((genre) => ({
          genreId: new ObjectId(genre.genreId),
          genreName: genre.genreName,
        })),
        cast: castArray.map((actor) => ({
          actorId: new ObjectId(actor.actorId),
          characterName: actor.characterName,
          role: actor.role,
          screenTime: parseInt(actor.screenTime),
        })),
        technicalSpecs: {
          resolution: '4K',
          audioFormats: ['Dolby Digital', 'DTS'],
          subtitleLanguages: ['English', 'Spanish', 'French'],
        },
        streamingQuality: ['SD', 'HD', '4K'],
        videoUrl: result.secure_url,
        publicId: result.public_id,
      };

      const insertResult = await db.collection('films').insertOne(film);
      
      res.status(201).json({
        success: true,
        message: 'Film uploaded successfully',
        filmId: insertResult.insertedId,
        film: {
          title: film.title,
          videoUrl: film.videoUrl,
          uploadedBy: film.uploadedBy
        }
      });
    } catch (error) {
      console.error('Error uploading film:', error);
      res.status(500).json({ 
        success: false,
        message: 'Error uploading film', 
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  },

  // Get all films with pagination
  async getFilms(req, res) {
    try {
      const db = getDB();
      const { page = 1, limit = 10, genre, search } = req.query;

      const skip = (page - 1) * limit;
      const query = {};

      if (genre) {
        query['genres.genreName'] = genre;
      }

      if (search) {
        query.title = { $regex: search, $options: 'i' };
      }

      const films = await db.collection('films').find(query).skip(skip).limit(parseInt(limit)).toArray();

      const total = await db.collection('films').countDocuments(query);

      res.json({
        films,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalFilms: total,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Get film by title
  async getFilmByTitle(req, res) {
    try {
      const db = getDB();
      const { title } = req.params;

      // Decode URI component to handle spaces and special characters
      const decodedTitle = decodeURIComponent(title);

      const film = await db
        .collection('films')
        .aggregate([
          {
            $match: {
              title: {
                $regex: new RegExp(`^${decodedTitle}$`, 'i'), // Case insensitive exact match
              },
            },
          },
          {
            $lookup: {
              from: 'studios',
              localField: 'studioId',
              foreignField: '_id',
              as: 'studio',
            },
          },
          {
            $lookup: {
              from: 'reviews',
              localField: '_id',
              foreignField: 'filmId',
              as: 'reviews',
            },
          },
          {
            $lookup: {
              from: 'genres',
              localField: 'genres.genreId',
              foreignField: '_id',
              as: 'genreDetails',
            },
          },
          {
            $addFields: {
              studio: { $arrayElemAt: ['$studio', 0] },
              averageRating: { $avg: '$reviews.rating' },
              reviewCount: { $size: '$reviews' },
            },
          },
        ])
        .toArray();

      if (!film || film.length === 0) {
        return res.status(404).json({ message: 'Film not found' });
      }

      // If multiple films found (unlikely with exact match), return the first one
      res.json(film[0]);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Update film view count and analytics
  async updateViewCount(req, res) {
    try {
      const db = getDB();
      const film = req.film; // From middleware
      const user = req.user; // From auth middleware
      const { watchDuration, quality, device } = req.body;

      // Validate required fields
      if (!watchDuration || !quality || !device) {
        return res.status(400).json({
          message: 'Missing required fields',
          required: ['watchDuration', 'quality', 'device']
        });
      }

      // Update film view count
      await db.collection('films').updateOne(
        { _id: film._id },
        { $inc: { viewCount: 1 } }
      );

      // Add to watch history with detailed information
      const watchHistory = {
        userId: user._id,
        username: user.username,
        filmId: film._id,
        film: {
          filmId: film._id,
          title: film.title,
        },
        watchDate: new Date(),
        watchDuration,
        watchSession: {
          quality,
          device,
          startTime: new Date(),
          endTime: new Date(Date.now() + watchDuration * 1000),
          deviceInfo: {
            type: device,
            timestamp: new Date()
          }
        }
      };

      await db.collection('watchHistory').insertOne(watchHistory);

      res.json({
        success: true,
        message: 'View recorded successfully',
        film: {
          title: film.title,
          viewCount: film.viewCount + 1,
        },
        viewer: {
          username: user.username,
          watchDuration,
          quality,
          device
        }
      });
    } catch (error) {
      console.error('Error recording view:', error);
      res.status(500).json({ 
        success: false,
        message: error.message 
      });
    }
  },
};

module.exports = filmController;
