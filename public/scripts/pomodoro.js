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
  handleVisibilityChange();
});

// Gestione della visibilità della pagina
function handleVisibilityChange() {
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') {
      debugLog('Pagina non visibile. Metto in pausa il timer.');
      pauseSession(); // Mette in pausa il timer se la pagina non è visibile
    }
  });
}

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

// Funzione per aggiornare lo stato della sessione
function updateSessionState(state) {
  switch (state) {
    case 'paused':
      document.getElementById('start-timer').style.display = 'block';
      document.getElementById('start-timer').textContent = 'Resume';
      document.getElementById('pause-timer').style.display = 'none';  
      document.getElementById('stop-timer').style.display = 'block';
      if (isRunning) {
        isRunning = false;
        clearInterval(timerId);
        fetchSessionData(); 
      }
      break;
    case 'interval':
      document.getElementById('start-timer').style.display = 'none';  
      document.getElementById('pause-timer').style.display = 'none';  
      document.getElementById('stop-timer').style.display = 'block';
      if (!isRunning) fetchSessionData();
      break;
    case 'active':
      document.getElementById('start-timer').style.display = 'none'; 
      document.getElementById('pause-timer').style.display = 'block';  
      document.getElementById('stop-timer').style.display = 'block';
      if (!isRunning) {
        updateTimerDisplay();
        startTimer();
      }
      break;
    case 'completed':
      document.getElementById('start-timer').style.display = 'block'; 
      document.getElementById('pause-timer').style.display = 'none';  
      document.getElementById('stop-timer').style.display = 'none';
      if (!isRunning) startNewSession();
      break;
    case 'aborted':
      document.getElementById('start-timer').style.display = 'block'; 
      document.getElementById('start-timer').textContent = 'Start Again';
      document.getElementById('pause-timer').style.display = 'none';  
      document.getElementById('stop-timer').style.display = 'none';
      break;
    default:
      debugLog('Stato della sessione non riconosciuto.');
  }

  document.getElementById('timer-status').textContent = state.toUpperCase();
  debugLog('Stato della sessione:', state);
}

// Funzione per inizializzare il timer basandosi sui dati della sessione
function initializeTimer(data) {
  debugLog('Inizializzazione timer con dati:', data);
  const now = new Date();
  const startTime = new Date(data.startTime);
  const elapsed = (now.getTime() - startTime.getTime()) / 1000; // Tempo trascorso dall'inizio della sessione

  let sessionState;

  if (data.pausedTime) {
    sessionState = 'paused';
  } else if (!data.completed) {
    if (data.intervalTime) {
      sessionState = 'interval';
    } else {
      sessionState = 'active';
    }
  } else {
    sessionState = 'completed';
  }

  debugLog('Stato della sessione:', sessionState);

  switch (sessionState) {
    case 'paused':
      pausedDuration = (now.getTime() - new Date(data.pausedTime).getTime()) / 1000;
      duration = data.durationMinutes * 60 - (elapsed - pausedDuration - data.totalPausedDuration);
      updateTimerDisplay();
      debugLog('Sessione ripristinata dalla pausa. Tempo di pausa effettivo:', pausedDuration);
      break;
    case 'interval':
      const intervalTime = new Date(data.intervalTime);
      const intervalElapsed = (now.getTime() - intervalTime.getTime()) / 1000;
      const intervalMinutes = data.cycle % 4 === 0 ? data.longBreakMinutes * 60 : data.breakMinutes * 60;
      duration = intervalMinutes - intervalElapsed;
      updateTimerDisplay();
      startTimer();
      debugLog('Sessione in pausa pranzo. Tempo rimanente:', duration);
      break;
    case 'active':
      duration = data.durationMinutes * 60 - (elapsed - data.totalPausedDuration);
      updateTimerDisplay();
      startTimer();
      debugLog('Sessione attiva. Durata rimanente:', duration);
      break;
    case 'completed':
      debugLog('Sessione marcata come completata. Reset e avvio di una nuova sessione.');
      resetTimer();
      startNewSession();
      break;
    default:
      debugLog('Stato della sessione non riconosciuto.');
  }

  updateSessionState(sessionState);
  setInterval(updatePausedTimerDisplay, 1000); // Aggiorna il timer di pausa ogni secondo
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
  document.getElementById('timer-display').textContent = ` ${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
  debugLog(`Aggiornamento display timer: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`);
}

function updatePausedTimerDisplay() {
  if (currentSession && currentSession.pausedTime) {
    const now = new Date();
    let totalPausedDuration = Number(currentSession.totalPausedDuration) || 0;  // Assicurati di definire la variabile qui
    const pausedTime = new Date(currentSession.pausedTime);
    const pausedDuration = (now.getTime() - pausedTime.getTime()) / 1000;
    totalPausedDuration += pausedDuration;  // Aggiungi la durata corrente della pausa al totale

    const pausedMinutes = Math.floor(totalPausedDuration / 60);
    const pausedSeconds = Math.floor(totalPausedDuration % 60);
    const maxPausedMinutes = Math.floor(currentSession.maxPausedDuration / 60);
    const maxPausedSeconds = Math.floor(currentSession.maxPausedDuration % 60);
    document.getElementById('timer-display').textContent = `${pausedMinutes}:${pausedSeconds < 10 ? '0' + pausedSeconds : pausedSeconds} / ${maxPausedMinutes}:${maxPausedSeconds < 10 ? '0' + maxPausedSeconds : maxPausedSeconds}`;
    debugLog(`Aggiornamento display timer in pausa: ${pausedMinutes}:${pausedSeconds < 10 ? '0' : ''}${pausedSeconds}`);
  }
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
    if (!data) {
      console.error('Dati della sessione non validi:', data);
      throw new Error('Dati della sessione ricevuti non validi');
    }
    updateSessionState('active');
    currentSession = data;
    duration = data.durationMinutes * 60;
  })
  .catch(error => {
    console.error('Errore nell\'avvio della nuova sessione:', error);
  });
}

// Funzione per mettere in pausa la sessione
function pauseSession() {
  debugLog('Messa in pausa della sessione...');
  if (!currentSession) {
    console.error('Nessuna sessione attiva da mettere in pausa.');
    return;
  }
  if (!currentSession.intervalTime) {
    fetch(`/api/pomodoro/${currentSession._id}/pause`, {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ action: 'pause' })
    })
    .then(() => { 
      updateSessionState('paused'); 
      debugLog('Sessione messa in pausa.'); 
    })
    .catch(error => console.error('Errore nel mettere in pausa la sessione:', error));
  }
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
    currentSession = data;
    updateSessionState('active');
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
    resetTimer();
    updateSessionState(state);
    debugLog(`Sessione completata con stato: ${state}`);
  })
  .catch(error => console.error('Errore nel completamento della sessione:', error));
}
