const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const _ = require("lodash");
const cors = require("cors");
const expressSession = require("express-session");
const flash = require("connect-flash");
const passport = require("passport"); 
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcrypt"); // per criptare le password
const markdown = require("markdown").markdown;

const stripHtmlTags = (text) => text.replace(/<\/?[^>]+(>|$)/g, ""); // Function to strip HTML tags

let debug = true; // Imposta questa variabile su true per attivare i log, false per disattivarli

// Funzione per eseguire i log condizionalmente
function debugLog(...messages) {
  if (debug) {
    console.log(...messages);
  }
}

// Middleware setup
app.use(cors());
app.set("view engine", "ejs"); // Set EJS as the view engine
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/scripts", express.static(path.join(__dirname, "node_modules/markdown/lib")));
app.use('/css', express.static(global.rootDir + '/public/css'));
app.use('/js', express.static(global.rootDir + '/public/js'));

app.use(
  expressSession({
    secret: "yourSecretKey",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // Set to 'true' only for HTTPS
  })
);

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use((req, res, next) => {
  res.locals.flashMessages = req.flash(); // Make flash messages available in views
  res.locals.username = req.isAuthenticated() ? req.user.username : null; // Provide username if authenticated
  next(); // Continue with the next middleware
});

// MongoDB connection
const mongoDBUri = "mongodb+srv://marcoguiidi:marcoprova@cluster0.lfjcmtr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
mongoose.connect(mongoDBUri, { useNewUrlParser: true, useUnifiedTopology: true });

mongoose.connection.on("connected", () => console.log("Connected to MongoDB"));
mongoose.connection.on("reconnected", () => console.log("Reconnected to MongoDB"));
mongoose.connection.on("disconnected", () => console.log("Disconnected from MongoDB"));
mongoose.connection.on("error", (err) => console.error("MongoDB connection error:", err));

// Close MongoDB connection on SIGINT (Ctrl+C)
process.on("SIGINT", () => {
  mongoose.connection.close(() => {
    console.log("MongoDB connection closed due to application termination");
    process.exit(0);
  });
});

// Mongoose schemas
// const blogSchema = new mongoose.Schema({
//   heading: String,
//   content: String,
//   author: String,
//   date: { type: Date, default: Date.now },
//   place: String,
//   tags: {
//     type: [String], // Tags as an array
//     validate: {
//       validator: function (tags) {
//         //controlla che ogni tag sia di tipo stringa, trimma gli spazi ai lati e controlla che la lunghezza sia > 0 
//         return tags.every(tag => typeof tag === 'string' && tag.trim().length > 0);
//       },
//       message: 'All tags must be non-empty strings', // in caso validator non restituisca true
//     },
//   },
// });
const eventSchema = new mongoose.Schema({
  description: String,
  date: Date,
  location: String,
  author: String,
  participants: {
    type: [String], // Tags as an array
    validate: {
      validator: function (participants) {
        //controlla che ogni tag sia di tipo stringa, trimma gli spazi ai lati e controlla che la lunghezza sia > 0 
        return participants.every(part => typeof part === 'string' && part.trim().length > 0);
      },
      message: 'All participants must be non-empty strings', // in caso validator non restituisca true
    },
  },
  color: String,
})


const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true }, // deve essere unico nel database
  password: { type: String, required: true },
});

const Event = mongoose.model("Event", eventSchema);
const User = mongoose.model("User", userSchema);

// Passport setup for user authentication
passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = await User.findOne({ username });  // search for username in db
      if (!user) {
        return done(null, false, { message: "Incorrect username or password." }); 
      }

      const isValidPassword = await bcrypt.compare(password, user.password); // compare password against database password
      if (!isValidPassword) {
        return done(null, false, { message: "Incorrect username or password." });
      }

      return done(null, user); // Successful authentication - go to next step
    } catch (err) {
      return done(err); // Error during authentication
    }
  })
);

passport.serializeUser((user, done) => {
  done(null, user._id); // serializza l'id utente
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user); //chiama done(), funzione di passport che gestisce success/error o fail
  } catch (err) {
    done(err); // Handle errors during deserialization
  }
});

// middleware per mantenere l'autenticazione dell'utente
// la aggiungo ai parametri di routing cosi da controllare ceh sia autenticato prima di effettuarlo
const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next(); // User is authenticated
  }
  res.redirect("/login"); // Redirect if not authenticated
};

// Routes for login and registration
app.get("/login", (req, res) => {
  res.render("login", { username: req.user ? req.user.username : null });
});


app.post( //https://betaweb.github.io/flashjs/ ma non implementato nella versione corrente
  "/login",
  passport.authenticate("local", {
    successRedirect: "/", // Redirect after successful login
    failureRedirect: "/login", // Redirect after failed login
    failureFlash: true, // Enable flash messages
  })
);

app.get("/register", (req, res) => {
  res.render("register", { username: req.user ? req.user.username : null });
});

app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      password: hashedPassword, // Store the hashed password
    });

    await newUser.save();

    req.login(newUser, (err) => {
      if (err) {
        return res.status(500).send("Error during login after registration.");
      }

      res.redirect("/"); // Redirect after successful registration
    });
  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).send("Registration failed."); // Handle registration errors
  }
});

app.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error("Error during logout:", err);
      return res.status(500).send("Error during logout.");
    }

    res.redirect(302, "/login"); // Use a valid status code and clear redirect
  });
});

// Main routes
app.get("/", ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      console.error("User not found");
      return res.status(404).send("User not found"); // If user is not found
    }
 

    res.render("home", {
      content: "Welcome to your Pomodoro&Calendar App!", // Example content
      username: user.username, // Pass username to the template
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Error."); // Handle errors
  }
});

app.get("/events", ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    const data = await Event.find({ 
      author: user.username || 
      participants.contains(user.username) // !! non funziona !!
    });

    const eventData = data.map(event => ({
      description: event.description,
      author: event.author,
      date: event.date, // Ottiene solo la parte della data
      participants: event.participants,
      location: event.location,
      color: event.color
    }));

    res.json(eventData);

  } catch (error) {
    res.status(500).json({ error: "Errore durante il recupero dei dati" });
  }
});

app.get("/compose", ensureAuthenticated, (req, res) => {
  res.render("compose");
});

app.post("/compose", ensureAuthenticated, async (req, res) => {
  const userId = req.user._id;
  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).send("User not found");
  }



// Clean and sanitize tags
const participants = (req.body.participants && typeof req.body.participants === 'string')
  ? JSON.parse(req.body.participants)  // Only parse if it's a valid JSON string
  : Array.isArray(req.body.participants) 
    ? req.body.participants            // If it's already an array
    : [];                      // Fallback to an empty array

const sanitizedParts = participants.map(part => part.trim().replace(/[^a-zA-Z0-9-_ ]/g, "")); // Strip special characters and spaces at ends


const newEvent = new Event({
  description: req.body.description,
  author: user.username,
  date: req.body.date.split('T')[0],
  participants: sanitizedParts, // Use the sanitized tags array
  location: req.body.location,
  color: req.body.color,

});

try {
  await newEvent.save(); // Save to the database
  res.redirect("/calendar"); // Redirect after successful save
} catch (error) {
  console.error("Error saving:", error); // Handle error
  res.status(500).send("Error saving."); // Respond with a server error
}
});

app.get("/calendar", ensureAuthenticated, (req, res) =>  {
  res.render("calendar", {username: User.findById(req.user._id)});
});

app.get("/weekCalendar", ensureAuthenticated, (req, res) =>  {
  res.render("weekCalendar");
});
// app.get("/users/:username/calendar", async (req, res) => {
//   try {
//     const username = req.params.username;
//     // const eventTitle = decodeURIComponent(req.params.eventTitle);
//     const user = await User.findOne({ username });

//     if (!user) {
//       console.error("User not found");
//       return res.status(404).send("User not found");
//     }



//     // const event = await Event.findOne({
//     //   description: new RegExp("^" + _.escapeRegExp(todoTitle) + "$", "i"),
//     //   author: username,
//     // });


//     // if (!event) {
//     //   return res.status(404).send("not found");
//     // }

//     // res.render("calendar", {
//     //   id: todo._id,
//     //   title: todo.title,
//     //   author: todo.author,
//     //   date: todo.date,
//     //   tags: todo.tags,
//     // });
//   } catch (error) {
//     console.error("Error fetching todo:", error);
//     res.status(500).send("Error fetching todo.");
//   }
// });


// app.post("/users/:username/todos/delete/:id", ensureAuthenticated, async (req, res) => {
//   try {
//     const todoID = req.params.id;
//     const todo = await Todo.findById(todoID);

//     if (!todo) {
//       return res.status(404).send("ToDo not found");
//     }

//     if (todo.author !== req.user.username) {
//       return res.status(403).send("You don't have permission to delete this todo.");
//     }

//     await Todo.findByIdAndDelete(todoID);

//     res.redirect("/"); // Redirect after successful deletion
//   } catch (error) {
//     console.error("Error deleting todo:", error);
//     res.status(500).send("Error deleting todo.");
//   }
// });

// app.get('/search', async (req, res) => {
//   const queryText = req.query.query.trim();

//   if (queryText.length < 3) {
//     return res.status(400).send("Query text must be at least 3 characters long.");
//   }

//   try {
//     // Use `$or` to search for posts with matching titles or tags
//     const matchingTodos = await Todo.find({
//       $or: [
//         { title: { $regex: queryText, $options: 'i' } }, // Case-insensitive search by title
//         { tags: { $in: [new RegExp(queryText, 'i')] } } // Search tags array for a matching tag
//       ]
//     });

//     res.json(matchingTodos); // Return the matching posts as JSON
//   } catch (error) {
//     console.error('Error fetching search results:', error);
//     res.status(500).send("Error fetching search results.");
//   }
// });

app.post("users/:username/events//delete/:eventID", ensureAuthenticated, async (req, res) => {
    try {
      const eventID = req.params.eventID;
      const event = await Event.findById(eventID);
  
      if (!event) {
        return res.status(404).send("event not found");
      }
  
      if (event.author !== req.user.username) {
        return res.status(403).send("You don't have permission to delete this event.");
      }
  
      await Event.findByIdAndDelete(eventID);
  
      res.redirect("/calendar"); // Redirect after successful deletion
    } catch (error) {
      console.error("Error deleting event:", error);
      res.status(500).send("Error deleting event.");
    }
});

// Route per la pagina del timer Pomodoro
app.get('/pomodoro', ensureAuthenticated, (req, res) => {
  res.render('pomodoro', {
    title: 'Pomodoro Timer', // Titolo della pagina
    user: req.user // Dati utente per personalizzare la vista
  });
  debugLog('Pagina del timer Pomodoro servita.');
});

// Schema per la sessione di Pomodoro usando Mongoose
const pomodoroSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  durationMinutes: { type: Number, default: 1 }, // Durata predefinita della sessione
  breakMinutes: { type: Number, default: 1 }, // Durata predefinita della pausa breve
  longBreakMinutes: { type: Number, default: 2 }, // Durata predefinita della pausa lunga
  cycle: { type: Number, default: 1 }, // Numero di cicli completati
  startTime: Date, // Ora di inizio sessione
  pausedTime: Date, // Ora di inizio pausa
  intervalTime: Date, // Ora di inizio intervallo
  totalPausedDuration: { type: Number, default: 0 }, // Durata totale delle pause
  maxPausedDuration: { type: Number, default: 1800 }, // Durata massima della pausa in secondi
  endTime: Date, // Ora di fine sessione
  completed: { type: Boolean, default: false }, // Stato di completamento della sessione
  effectiveStudyTime: Number // Tempo effettivo di studio
});

// Modello Mongoose basato sullo schema definito
const PomodoroSession = mongoose.model('PomodoroSession', pomodoroSessionSchema);

// Definizione della route per avviare una nuova sessione di Pomodoro
app.post('/api/pomodoro/start', ensureAuthenticated, async (req, res) => {
  try {
    // Trova l'ultima sessione completata dell'utente
    const lastCompletedSession = await PomodoroSession.findOne({
      userId: req.user._id,
      completed: true
    }).sort({ endTime: -1 });

    debugLog('Ultima sessione completata trovata:', lastCompletedSession);
    const now = new Date();
    let cycle = 1; // Valore di ciclo predefinito

    // Se esiste una sessione completata, verifica il tempo trascorso dalla sua fine
    if (lastCompletedSession && lastCompletedSession.endTime && lastCompletedSession.effectiveStudyTime) {
      const timeSinceLastSessionEnd = (now - lastCompletedSession.endTime) / 1000 / 60;
      if (timeSinceLastSessionEnd < lastCompletedSession.maxPausedDuration) {
        cycle = lastCompletedSession.cycle;
      }
    }

    // Crea una nuova sessione con il ciclo calcolato
    const session = new PomodoroSession({
      userId: req.user._id,
      cycle: cycle,
      startTime: now,
      pausedTime: null,
      totalPausedDuration: 0,
      endTime: null,
      intervalTime: null,
      completed: false,
    });

    await session.save();
    res.status(201).send(session);
  } catch (error) {
    console.error('Errore durante l\'avvio di una nuova sessione:', error);
    res.status(400).send(error);
  }
});

// Route per gestire le azioni sulla sessione (pausa, ripresa, stop)
app.patch('/api/pomodoro/:id/:action', ensureAuthenticated, async (req, res) => {
  const { action, id: sessionId } = req.params;
  const { state } = req.body;

  debugLog('Azione:', action, 'Stato:', state, 'ID Sessione:', sessionId);

  try {
    const session = await PomodoroSession.findById(sessionId);
    if (!session) {
      return res.status(404).send('Sessione non trovata');
    }

    const now = new Date();

    // Gestisce l'azione sulla sessione in base al parametro 'action'
    switch (action) {
      case 'start':
        if (session.startTime) {
          return res.status(400).send('La sessione è già iniziata');
        }
        session.startTime = now;
        break;
      case 'stop':
        session.endTime = now;
        const totalTime = (now - session.startTime) / 1000;
        switch (state) {
          case 'aborted':
            session.completed = true;
            break;
          case 'completed':
            session.effectiveStudyTime = totalTime - session.totalPausedDuration;
            session.cycle += 1;
            session.completed = true;
            debugLog('Sessione completata con successo, nuovo ciclo:', session.cycle);
            break;
          case 'interval':
            session.intervalTime = now;
            debugLog('Sessione completata con successo, in attesa dell\'intervallo');
            break;
        }
        break;
      case 'pause':
        if (!session.pausedTime) {
          session.pausedTime = now;
        }
        break;
      case 'resume':
        if (session.pausedTime && !session.intervalTime) {
          const pausedDuration = (now - session.pausedTime) / 1000;
          session.totalPausedDuration += pausedDuration;
          session.pausedTime = null;
        }
        debugLog('Sessione ripresa.');
        break;
      default:
        return res.status(400).send('Azione non valida');
    }

    await session.save();
    res.status(200).send(session);
  } catch (error) {
    console.error('Errore durante la gestione della sessione:', error);
    res.status(500).send(error);
  }
});

// Route per recuperare l'ultima sessione attiva dell'utente
app.get('/api/pomodoro/last', ensureAuthenticated, async (req, res) => {
  debugLog('Inizio ricerca ultima sessione per l\'utente:', req.user._id);

  const findAndUpdateSession = async () => {
    try {
      debugLog('Cercando l\'ultima sessione non completata...');
      let lastSession = await PomodoroSession.findOne({
        userId: req.user._id,
        completed: false
      }).sort({ startTime: -1 });

      if (!lastSession) {
        debugLog('Nessuna sessione attiva trovata');
        return null; // Nessuna sessione attiva trovata
      }

      debugLog('Sessione trovata:', lastSession);

      const now = new Date();
      let sessionNeedsUpdate = false;

      // Calcola la durata totale della pausa
      const totalPausedDuration = lastSession.pausedTime ? (now.getTime() - new Date(lastSession.pausedTime).getTime()) / 1000 + lastSession.totalPausedDuration : lastSession.totalPausedDuration;
      debugLog('Durata totale della pausa:', totalPausedDuration);

      // Calcola il tempo trascorso dall'intervallo, se presente
      const intervalElapsed = lastSession.intervalTime ? (now.getTime() - new Date(lastSession.intervalTime).getTime()) / 1000 : 0;
      debugLog('Tempo trascorso dall\'intervallo:', intervalElapsed);

      // Calcola il tempo trascorso totale dalla sessione
      const elapsed = (now.getTime() - lastSession.startTime.getTime()) / 1000;
      debugLog('Tempo trascorso dalla sessione:', elapsed);

      // Verifica se la sessione deve essere completata
      if (totalPausedDuration >= lastSession.maxPausedDuration || intervalElapsed >= (lastSession.cycle % 4 === 0 ? lastSession.longBreakMinutes * 60 : lastSession.breakMinutes * 60) || elapsed - lastSession.totalPausedDuration >= ( lastSession.durationMinutes * 60 + (lastSession.maxPausedDuration - lastSession.totalPausedDuration) )  ) {
        sessionNeedsUpdate = true;
        debugLog('Sessione completata per superamento dei limiti');
        if (totalPausedDuration >= lastSession.maxPausedDuration) {
          debugLog('Limite massimo di pausa superato');
        }
        if (intervalElapsed >= (lastSession.cycle % 4 === 0 ? lastSession.longBreakMinutes * 60 : lastSession.breakMinutes * 60)) {
          debugLog('Limite di intervallo superato');
        }
        if (elapsed - lastSession.totalPausedDuration >= ( lastSession.durationMinutes * 60 + (lastSession.maxPausedDuration - lastSession.totalPausedDuration) ) ) {
          debugLog('Limite di tempo di studio superato');
        }
        
      }

      if (sessionNeedsUpdate) {
        lastSession.completed = true;
        await lastSession.save();
        debugLog('Sessione aggiornata e salvata, ricercando la prossima sessione...');
        return findAndUpdateSession(); // Richiama la funzione ricorsivamente se la sessione è stata aggiornata
      } else {
        debugLog('Sessione attiva trovata e restituita');
        return lastSession; // Restituisce la sessione attiva trovata
      }
    } catch (error) {
      console.error('Errore durante la ricerca o l\'aggiornamento della sessione:', error);
      throw error; // Propaga eventuali errori al blocco try-catch esterno
    }
  };

  try {
    const session = await findAndUpdateSession();
    if (session) {
      res.status(200).send(session);
    } else {
      res.status(404).send({ message: 'Nessuna sessione attiva trovata' });
    }
  } catch (error) {
    console.error('Errore durante il recupero dell\'ultima sessione:', error);
    res.status(500).send(error);
  }
});

// Listen on default port 3000
app.listen(3000, () => {
  console.log("Server running on port 3000");
});

