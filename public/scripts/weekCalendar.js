

document.addEventListener('DOMContentLoaded', function() {
    let currentYear = new Date().getFullYear();
    let currentMonth = new Date().getMonth(); // Nota: i mesi in JavaScript sono indicizzati da 0 a 11
    let currentDay = new Date().getDate();
    let firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // Ottieni il giorno della settimana del primo giorno del mese
    let startDay = currentDay - firstDayOfWeek + 1; // Calcola il primo giorno della settimana corrente
    let endDay = startDay + 6; // Calcola l'ultimo giorno della settimana corrente


    // Funzione per ottenere il nome del mese dato il suo indice
    function getMonthName(monthIndex) {
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        return months[monthIndex];
    }

    // Funzione per generare i giorni del calendario per la settimana corrente
    function generateCalendarDays(year, month, startDay, endDay) {
        let days = [];

        const firstDay = new Date(year, month, startDay).getDay();
        const lastDay = new Date(year, month, endDay).getDay();
        

        let incr = 0;
        // Aggiungi i giorni della settimana corrente al calendario
        for (let i = 0; i <= 6; i++) {
            if (i < firstDay) {
                days.push('');
            } else  if (i > lastDay) {
                days.push('');
            } else {
                if (startDay + incr > 0 || startDay + incr  < getDaysInMonth(year, month))
                    days.push(startDay + incr);
                else days.push('');
                incr++;
            }
        }

        return days;

    }

    // Aggiungere un event listener al pulsante per visualizzare la settimana precedente
    document.getElementById('prevWeekButton').addEventListener('click', function() {
        endDay = startDay - 1;
        startDay = endDay - 6;
        if (startDay <= 0) {
            startDay = 1;
        }
        if (endDay <= 0) {
            currentMonth--; // Passa al mese precedente
            if (currentMonth < 0) {
                currentMonth = 11;
                currentYear--;
            }
            endDay = getDaysInMonth(currentYear, currentMonth);
            const lastDay = new Date(currentYear, currentMonth, endDay).getDay();
            startDay = endDay - lastDay;
        }
        updateCalendar();
    });

    // Aggiungere un event listener al pulsante per visualizzare la settimana successiva
    document.getElementById('nextWeekButton').addEventListener('click', function() {
        startDay = endDay + 1;
        endDay = startDay + 6;
        if (endDay > getDaysInMonth(currentYear, currentMonth)) {
            endDay = getDaysInMonth(currentYear, currentMonth);
        }
        if (startDay > getDaysInMonth(currentYear, currentMonth)) {
            currentMonth++; // Passa al mese successivo
            if (currentMonth > 11) {
                currentMonth = 0;
                currentYear++;
            }
            startDay = 1;
            const firstDay = new Date(currentYear, currentMonth, startDay).getDay();
            endDay = startDay + (6 - firstDay) ;
        }
        updateCalendar();
    });
    updateCalendar();

    // Funzione per aggiornare il calendario con la settimana corrente
    function updateCalendar() {
        const calendarDays = generateCalendarDays(currentYear, currentMonth, startDay, endDay);
        const dayElements = document.querySelectorAll('.day button');
        const currentMonthElement = document.getElementById('currentMonth');

        // Popolare dinamicamente i giorni del calendario nel markup HTML e rendere visibili solo i button che hanno una data associata
        dayElements.forEach((button, index) => {
            if (index < 7 && calendarDays[index] != '') {
                let month = currentMonth + 1 < 10 ? `0${currentMonth + 1}` : currentMonth + 1;
                let day = calendarDays[index] < 10 ? `0${calendarDays[index]}` : calendarDays[index];
                button.innerHTML = `<time datetime="${currentYear}-${month}-${day}">${calendarDays[index]}</time>`;
                button.style.visibility = 'visible';
                console.log(button.textContent);
            } else if (calendarDays[index] == '') {
                // Nascondere dalla visualizzazione i pulsanti inutili
                button.innerHTML = '';
                button.style.visibility = 'hidden';
            }
        });

        // Aggiornare il nome del mese nell'header
        
        currentMonthElement.textContent = startDay === endDay ? `${startDay} ${getMonthName(currentMonth)} ${currentYear}` : `${startDay}-${endDay} ${getMonthName(currentMonth)} ${currentYear}`;

        const dialog = document.getElementById("event-dialog");

        // Funzione per gestire la visualizzazione degli eventi sotto il giorno corrispondente
        function CB(isevent) {
            document.getElementById('dialogEventTitle').innerHTML = isevent.description; // Imposta il titolo
            document.getElementById('dialogEventDate').innerHTML = "Date: " + isevent.date.split('T')[0]; // Imposta la data
            document.getElementById('dialogEventLocation').innerHTML = "Location: " + isevent.location; // Imposta la posizione
            document.getElementById('dialogEventID').innerHTML = isevent._id;
            let parts = document.getElementById('dialogEventParticipants'); // Imposta i partecipanti
            parts.innerHTML = "Participants: ";
            isevent.participants.forEach(function(participant) { // Cicla attraverso i partecipanti
                let li = document.createElement('li');
                li.innerHTML = participant; // Aggiungi il partecipante all'elemento li
                parts.appendChild(li); // Aggiungi il partecipante alla lista
            })

            dialog.showModal(); // Mostra la finestra di dialogo
        }

        dialog.querySelector('#dialog-form').onsubmit = function() {
            dialog.close();
        };

        fetch('/events') // Fetch events
            .then(response => response.json())
            .then(events => {
                const dateButtons = document.querySelectorAll('.day button'); // Get all the date buttons

                dateButtons.forEach(button => {
                    if (button.textContent != '') {
                        const date = button.querySelector('time').getAttribute('datetime');
                        const isevent = events.find(isevent => isevent.date && isevent.date.split('T')[0] == date);

                        if (isevent) {
                            const root = document.documentElement;
                            button.classList.add('has-event');
                            button.style.borderColor = isevent.color;

                            // Definire una chiusura per memorizzare l'event listener corrente
                            const actualEventHandler = (function(isevent) {
                                return function(event) {
                                    CB(isevent);
                                };
                            })(isevent);

                            // Rimuovere l'event listener precedente se esiste
                            if (button.eventListener) {
                                button.removeEventListener('click', button.eventListener);
                            }
                            button.addEventListener('click', actualEventHandler);
                            // Memorizzare l'event listener associato al pulsante
                            button.eventListener = actualEventHandler;
                        } else {
                            // Rimuovere l'event listener se il pulsante non ha un evento associato
                            if (button.eventListener) {
                                button.removeEventListener('click', button.eventListener);
                                delete button.eventListener; // Rimuovere il riferimento all'event listener dal pulsante
                            }
                            button.classList.remove('has-event');
                            button.style.borderColor = 'transparent';
                        }
                    }
                });

            })
            .catch(error => console.error('Error loading events:', error)); // Gestire eventuali errori nell'accesso agli eventi

    }

    // Funzione per ottenere il numero di giorni del mese
    function getDaysInMonth(year, month) {
        return new Date(year, month + 1, 0).getDate();
    }
    
});
