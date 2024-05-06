// Variabili globali
let isRunning = false;
let duration = null;
let timerId = null;
let currentSession = null; // Oggetto che terrà i dettagli della sessione attiva
let debug = true; // Imposta questa variabile su true per attivare i log, false per disattivarli

// Funzione per eseguire i log condizionalmente
function debugLog(...messages) {
  if (debug) {
    console.log(...messages);
  }
}

// Evento che si attiva al caricamento completo del documento
document.addEventListener('DOMContentLoaded', function() {
  debugLog('Documento caricato. Recupero dati sessione...');
  fetchSessionData();
});

// Funzione per recuperare i dati della sessione corrente dal server
function fetchSessionData() {
  debugLog('Inizio recupero dati ultima sessione...');
  fetch('/api/pomodoro/last', {
    method: 'GET',
    headers: {'Content-Type': 'application/json'}
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Errore nel recupero dei dati');
    }
    return response.json();
  })
  .then(data => {
    debugLog('Dati sessione ricevuti:', data);
    if (data && !data.completed) {
      debugLog('Ultima sessione trovata:', data);
      currentSession = data;
      initializeTimer(data);
    } else {
      debugLog('Nessuna sessione attiva trovata. Avvio nuova sessione...');
      startNewSession();
    }
  })
  .catch(error => {
    console.error('Errore nel recupero dell\'ultima sessione:', error);
    startNewSession();
  });
}

// Funzione per inizializzare il timer basandosi sui dati della sessione
function initializeTimer(data) {
  debugLog('Inizializzazione timer con dati:', data);
  const now = new Date();
  const startTime = new Date(data.startTime);
  const elapsed = (now.getTime() - startTime.getTime()) / 1000; // Tempo trascorso dall'inizio della sessione

  let pausedDuration = 0; 
  let sessionState;

  if (data.pausedTime && pausedDuration <= data.maxPauseDuration) {
    sessionState = 'pausa';
  } else if (!data.completed) {
    if (data.intervalTime) {
      sessionState = 'intervallo';
    } else {
      sessionState = 'attiva';
    }
  } else {
    sessionState = 'completata';
  }

  debugLog('Stato della sessione:', sessionState);

  switch (sessionState) {
    case 'pausa':
      pausedDuration = (now.getTime() - new Date(data.pausedTime).getTime()) / 1000;
      duration = data.durationMinutes * 60 - (elapsed - pausedDuration - data.totalPausedDuration);
      updateTimerDisplay();
      debugLog('Sessione ripristinata dalla pausa. Tempo di pausa effettivo:', pausedDuration);
      break;
    case 'intervallo':
      const intervalTime = new Date(data.intervalTime);
      const intervalElapsed = (now.getTime() - intervalTime.getTime()) / 1000;
      const intervalMinutes = data.cycle % 4 === 0 ? data.longBreakMinutes * 60 : data.breakMinutes * 60;
      duration = intervalMinutes - intervalElapsed;
      updateTimerDisplay();
      startTimer();
      debugLog('Sessione in pausa pranzo. Tempo rimanente:', duration);
      break;
    case 'attiva':
      duration = data.durationMinutes * 60 - (elapsed - data.totalPausedDuration);
      updateTimerDisplay();
      startTimer();
      debugLog('Sessione attiva. Durata rimanente:', duration);
      break;
    case 'completata':
      debugLog('Sessione marcata come completata. Reset e avvio di una nuova sessione.');
      resetTimer();
      startNewSession();
      break;
    default:
      debugLog('Stato della sessione non riconosciuto.');
  }
}

// Gestione degli eventi click per i bottoni di controllo del timer
document.getElementById('start-timer').addEventListener('click', function() {
  debugLog('Click su "Avvia timer"');
  if (!isRunning && currentSession) {
    debugLog('Ripresa sessione...');
    resumeSession();
  } else if (!currentSession) {
    debugLog('Nessuna sessione attiva. Avvio nuova sessione...');
    startNewSession();
  }
});

document.getElementById('pause-timer').addEventListener('click', function() {
  debugLog('Click su "Metti in pausa timer"');
  if (isRunning) {
    debugLog('Pausa sessione...');
    pauseSession();
  }
});

document.getElementById('stop-timer').addEventListener('click', function() {
  debugLog('Click su "Ferma timer"');
  completeSession('aborted');
});

// Funzione per avviare il timer
function startTimer() {
  if (!isRunning) {
    isRunning = true;
    timerId = setInterval(updateTimer, 1000);
    debugLog('Timer avviato.');
  }
}

// Funzione per aggiornare il timer ogni secondo
function updateTimer() {
  duration--;
  updateTimerDisplay();

  let timerState;
  if (duration <= 0) {
    if (currentSession.intervalTime) {
      timerState = 'fine della pausa';
    } else {
      timerState = 'fine della sessione di lavoro';
    }
  } else {
    timerState = 'in esecuzione';
  }

  debugLog('Stato del timer:', timerState);

  switch (timerState) {
    case 'fine della sessione di lavoro':
      debugLog('Sessione di lavoro completata. Inizio pausa.');
      completeSession('interval');
      break;
    case 'fine della pausa':
      debugLog('Sessione e pausa completate.');
      completeSession('completed');
      break;
    case 'in esecuzione':
      // Nessuna azione richiesta
      break;
    default:
      debugLog('Stato del timer non riconosciuto.');
  }
}

// Funzione per aggiornare il display del timer
function updateTimerDisplay() {
  let seconds = Math.floor(duration);
  let minutes = Math.floor(seconds / 60);
  seconds %= 60;
  document.getElementById('timer-display').textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  debugLog(`Aggiornamento display timer: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`);
}

// Funzione per resettare il timer
function resetTimer() {
  clearInterval(timerId);
  isRunning = false;
  duration = null;
  currentSession = null;
  updateTimerDisplay();
  debugLog('Timer resettato.');
}

// Funzione per avviare una nuova sessione di Pomodoro
function startNewSession() {
  debugLog('Avvio di una nuova sessione...');
  fetch('/api/pomodoro/start', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'}
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Fallimento nell\'avvio di una nuova sessione');
    }
    return response.json();
  })
  .then(data => {
    debugLog('Dati della nuova sessione ricevuti:', data);
    if (!data || !data.durationMinutes) {
      console.error('Dati della sessione non validi:', data);
      throw new Error('Dati della sessione ricevuti non validi');
    }
    currentSession = data;
    duration = data.durationMinutes * 60;
    updateTimerDisplay();
    startTimer();
  })
  .catch(error => {
    console.error('Errore nell\'avvio della nuova sessione:', error);
    duration = 1500; // Imposta una durata predefinita in caso di errore
    updateTimerDisplay();
  });
}

// Funzione per mettere in pausa la sessione
function pauseSession() {
  debugLog('Messa in pausa della sessione...');
  if (!currentSession) {
    console.error('Nessuna sessione attiva da mettere in pausa.');
    return;
  }
  clearInterval(timerId);
  isRunning = false;
  fetch(`/api/pomodoro/${currentSession._id}/pause`, {
    method: 'PATCH',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ action: 'pause' })
  })
  .then(() => debugLog('Sessione messa in pausa.'))
  .catch(error => console.error('Errore nel mettere in pausa la sessione:', error));
}

// Funzione per riprendere la sessione
function resumeSession() {
  debugLog('Ripresa della sessione...');
  if (!currentSession) {
    console.error('Nessuna sessione attiva da riprendere.');
    return;
  }
  fetch(`/api/pomodoro/${currentSession._id}/resume`, {
    method: 'PATCH',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ action: 'resume' })
  })
  .then(response => response.json())
  .then(data => {
    isRunning = true;
    timerId = setInterval(updateTimer, 1000);
    debugLog('Sessione ripresa.');
  })
  .catch(error => console.error('Errore nella ripresa della sessione:', error));
}

// Funzione per completare la sessione
function completeSession(state) {
  debugLog(`Completamento della sessione: ${state}`);
  if (!currentSession) {
    console.error('Nessuna sessione attiva da completare.');
    return;
  }
  fetch(`/api/pomodoro/${currentSession._id}/stop`, {
    method: 'PATCH',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ action: 'stop', state: state })
  })
  .then(() => {
    debugLog(`Sessione completata con stato: ${state}`);
    resetTimer();
    if (state === 'completed') {
      startNewSession();
    }
    if (state === 'interval') {
      fetchSessionData();
    }
  })
  .catch(error => console.error('Errore nel completamento della sessione:', error));
}