const express = require('express')
const app = express()
const cors = require('cors')
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const moment = require('moment')
require('dotenv').config()

app.use(cors())
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});


// Get database URI
const MONGO_URI = process.env.MONGO_URI;

// Connect mongoose
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

// Create user schema
let userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  }, 
})

// Create user model
const User = mongoose.model('User', userSchema);

// Create log schema
let exerciseSchema = new mongoose.Schema({
  log: [{
      description: {
      type: String,
      required: true
    },
    duration: {
      type: Number,
      required: true
    },
    date: {
      type: Date,
      required: true
    }
  }]
})

// Create log model
const Exercise = mongoose.model('Exercise', exerciseSchema);

// Find record by username
const findRecordByUsername = (uname) => {
  return new Promise(async(resolve, reject) => {
    let usernameRecord = await User.findOne({username: uname});
    if (usernameRecord === null) {
      resolve();
    } else {
      reject();
    }
  })
}

// Find record by id
const findRecordById = (id) => {
  return new Promise(async(resolve, reject) => {
    let getRecord = await User.findOne({_id: id});
    
    if (getRecord !== null) {
      resolve(getRecord);
    } else {
      reject();
    }
  })
}

// Find all user
const findAllUser = () => {
  return new Promise(async(resolve, reject) => {
    let allUserData = await User.find({}, {__v: 0});
    if (allUserData !== null) {
      resolve(allUserData);
    } else {
      reject();
    }
  })
}

// Parser body from POST
app.use(bodyParser.urlencoded({extended: false}));

// POST to /api/users with form data username to create a new user
app.post('/api/users', async(req, res) => {
  const username = req.body.username;
  
  // Check if username already exist in database
  await findRecordByUsername(username)
    .then(async() => {
      const newRecord = await new User({username: username});
      await newRecord.save();
    }).catch((e) => {
      // do nothing
    });

  let userRecord = await User.findOne({username: username}, {username: 1});
  res.send({username: userRecord.username, _id: userRecord._id});
})

// GET request to /api/users to get a list of all users.
app.get('/api/users', async(req, res) => {
  await findAllUser()
    .then((result) => {
      res.send(result);
    }).catch(() => {
      res.end("There's no data yet");
    })
})

// POST to /api/users/:_id/exercises with form data description, duration, and optionally date to create or update exercise.
app.post('/api/users/:_id/exercises', async(req, res) => {
  const id = req.params._id;
  const description = req.body.description;
  const duration = Number(req.body.duration);
  const date = !req.body.date ? new Date() : new Date(req.body.date);

  // Find user record by id
  // If succed, then do with result
  // Otherwise, catch invalid ID
  await findRecordById(id)
    .then(async(result) => {
        // We update log of user with new added exercise
        Exercise.findOneAndUpdate(
          {_id: result._id},
          {"$push": {log: [{
            description: description,
            duration: duration,
            date: date
          }]}},
          {new: true}, async(err, data) => {
            // But if there's no exercise yet, create new
            if (data === null) {
              const newRecord = new Exercise({_id: result._id, log: [{
                description: description,
                duration: duration,
                date: date
              }]});
              await newRecord.save();
            }

            // Send the result
            res.send({
              _id: result.id,
              username: result.username,
              date: date.toDateString(),
              duration: duration,
              description: description
            });
            
          }
        )
    }).catch(() => {
      res.end("Invalid ID");
    })
})

// GET request to /api/users/:id/logs, return the user object with a log array of all the exercises added.
// Add from, to and limit parameters to a GET /api/users/:_id/logs request to retrieve part of the log of any user
app.get('/api/users/:_id/logs?', async(req, res) => {
  // Get id
  const id = req.params._id;
  // Get from date as start
  const from = req.query.from;
  // Get to date as end
  const to = req.query.to;
  // Get limit to limit number of exercise
  const limit = req.query.limit;

  await findRecordById(id)
    .then(async(result) => {
      // Find user log exercise by id
      let userExerciseData = await Exercise.findOne({_id: id}, {log: {_id: 0}});

      // If no exercise added yet, send empty log
      if (userExerciseData === null) {
        res.send({
          _id: result._id,
          username: result.username,
          count: 0,
          log: []
        });
      } else {
        // Get only log object
        let logData = userExerciseData.log;

        // If there's from OR to query in user GET
        if (from !== undefined || to !== undefined) {
            // Set default from date, as very long old date
            let fromDate = new Date(0);
            // Set default to date, as current date
            let toDate = new Date();

            // If there's from query, set date as it value
            // Otherwise, it will be just default value above
            if (from !== undefined) {
              fromDate = new Date(from);
            }

            // If there's to query, set date as it value
            // Otherwise, it will be just default value above
            if (to !== undefined) {
              toDate = new Date(to);
            }

            // Get time of both date as comparison
            fromDate = fromDate.getTime();
            toDate = toDate.getTime();

            // Filter the log by date
            logData = userExerciseData.log.filter((item) => {
              let sessionDate = item.date.getTime();
              return sessionDate >= fromDate && sessionDate <= toDate;
            })
        }

        // Limit the log
        if (limit) {
          logData = logData.slice(0, limit);
        }

        res.send({
          _id: result._id,
          username: result.username,
          count: logData.length,
          log: logData.map((item) => {
            return {
              description: item.description,
              duration: item.duration,
              date: item.date.toDateString()
            }
          })
        })
      }
    }).catch(() => {
      res.end("Invalid ID");
    })
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})

exports.UserModel = User;
exports.ExerciseModel = Exercise;
exports.findRecordByUsername = findRecordByUsername;
exports.findRecordById = findRecordById;
exports.findAllUser = findAllUser;