let bgMusic = false;

document.getElementById('studyForm').addEventListener('submit', function(event) {
  event.preventDefault();

  let music = document.getElementById("inAudio");

  let contatore = 0;
  const studyTime = parseInt(document.getElementById('studyTime').value, 10);
  const pauseTime = parseInt(document.getElementById('pauseTime').value, 10);
  const times = parseInt(document.getElementById('times').value, 10);
  const animationDuration = studyTime * 60;

  function avviaTimer() {
    contatore++;
    if (bgMusic) {
      music.play();
    }
  
    const styleSheet = createStyleSheet(`
    body {
      animation: bg ${animationDuration}s 1;
    }
    
    .hider {
      display: none;
    }
    
    .timer {
      display: flex;
      animation: timer 5s 1;
    }
  
    #pause {
      display: none;
    }
    
    #stop {
      visibility: visible;
      animation: sButton ${animationDuration}s 1;
    }
    `);

    document.getElementById("task").textContent = "STUDY TIME";
  
    const endStudyTime = Date.now() + studyTime * 60000;
    const studyInterval = startInterval(endStudyTime, function() {
      clearInterval(studyInterval);
      music.pause();
      let audio = document.getElementById("endAudio");
      audio.play();
      setTimeout(function() {
        audio.pause();
        document.getElementById('timerDisplay').textContent = "00:00";
        removeStyleSheet(styleSheet);
        avviaPausa();
      }, 3000);
    }, function(difference) {
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);
      document.getElementById('timerDisplay').textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    });
  }
  
  function avviaPausa() {
    const styleSheet = createStyleSheet(`
    #stop {
      visibility: visible;
    }
  
    .hider {
      display: none;
    }
  
    #pause {
      display: flex;
    }
  
    #clock {
      display: none;
    }
    `);

    document.getElementById("task").textContent = "PAUSE TIME";

  
    const endPauseTime = Date.now() + pauseTime * 60000;
    const pauseInterval = startInterval(endPauseTime, function() {
      clearInterval(pauseInterval);
      document.getElementById('pauseTimer').textContent = "00:00";
      
      document.getElementById("task").textContent = "";
      
      let trumpet = document.getElementById("trumpets");
      trumpet.play();
      setTimeout(function(){
        trumpet.pause();
        removeStyleSheet(styleSheet);
        if (contatore < times) {
          avviaTimer();
        }
      }, 3000);
      
    },function(difference) {
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        document.getElementById('pauseTimer').textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      });
  }

  if (contatore < times) {
    avviaTimer();
  }
});

function createStyleSheet(cssText) {
  const styleSheet = document.createElement("style");
  styleSheet.innerText = cssText;
  document.head.appendChild(styleSheet);
  return styleSheet;
}

function removeStyleSheet(styleSheet) {
  styleSheet.parentNode.removeChild(styleSheet);
}

function startInterval(endTime, callback, updateClockCallback) {
  return setInterval(function() {
    const now = Date.now();
    let difference = endTime - now;

    if (difference <= 0) {
      callback();
    } else {
      if (updateClockCallback) {
        updateClockCallback(difference);
      }
    }
  }, 1000);
}


document.getElementById("music").addEventListener("click", function(event){
  event.preventDefault();

  // Invertiamo lo stato della musica di background e cambiamo lo stile del pulsante
  bgMusic = !bgMusic;
  const opacity = bgMusic ? 1 : 0.6;
  const styleSheet = createStyleSheet(`
    #music {
      opacity: ${opacity};
    }
  `);
});

