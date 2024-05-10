document.addEventListener('DOMContentLoaded', function() {  // When the DOM is ready...

    let currentYear = new Date().getFullYear();
    let currentMonth = new Date().getMonth(); // Nota: i mesi in JavaScript sono indicizzati da 0 a 11

    // Funzione per ottenere il nome del mese dato il suo indice
    function getMonthName(monthIndex) {
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        return months[monthIndex];
    }

    // Funzione per generare i giorni del calendario per un dato mese e anno
    function generateCalendarDays(year, month) {
        const firstDayOfMonth = new Date(year, month, 1).getDay(); // Ottieni il giorno della settimana del primo giorno del mese
        const numDays = getDaysInMonth(year, month); // Ottieni il numero totale di giorni nel mese
        let days = [];

        // Aggiungi giorni vuoti prima del primo giorno del mese per allineare correttamente il calendario
        for (let i = 0; i < firstDayOfMonth; i++) {
            days.push(''); // Aggiungi un elemento vuoto per ogni giorno vuoto nella settimana prima del primo giorno del mese
        }

        // Aggiungi i giorni del mese al calendario
        for (let i = 1; i <= numDays; i++) {
            days.push(i); // Aggiungi il giorno corrente al calendario
        }

        for (let i = 0; i < 20; i++) {
            days.push(''); // Aggiungo 20 vuoti perchè non ho vogglia di fare il calcolo dei giorni vuoti rimanenti
        }

        return days;
    }

    function getDaysInMonth(year, month) {
        return new Date(year, month + 1, 0).getDate(); // Ottieni il numero di giorni del mese
    }

    

    // Aggiungere un event listener al pulsante del mese precedente
    document.getElementById('prevMonthButton').addEventListener('click', function() {
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        updateCalendar();
    });

    // Aggiungere un event listener al pulsante del mese successivo
    document.getElementById('nextMonthButton').addEventListener('click', function() {
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        updateCalendar();
    });
    updateCalendar();

    // Funzione per aggiornare il calendario con il mese e l'anno correnti
    function updateCalendar() {
        const calendarDays = generateCalendarDays(currentYear, currentMonth);
        const dayElements = document.querySelectorAll('.day button');
        const currentMonthElement = document.getElementById('currentMonth');

        // Popolare dinamicamente i giorni del calendario nel markup HTML e rende visibili solo i button che hanno una data associata
        dayElements.forEach((button, index) => {
            if (index < 42 && calendarDays[index] != '') {
                let month = currentMonth+1 < 10 ? `0${currentMonth+1}`: currentMonth + 1;
                let day = calendarDays[index] < 10 ? `0${calendarDays[index]}`: calendarDays[index];
                button.innerHTML = `<time datetime="${currentYear}-${month}-${day}">${calendarDays[index]}</time>`;
                button.style.visibility = 'visible';
            }else if (calendarDays[index] == '') {
                //nascondo dalla visualizzazione in pulsanti inutili
                button.innerHTML = '';
                button.style.visibility = 'hidden';
            }});

        

        // Aggiornare il nome del mese nell'header
        currentMonthElement.textContent = `${getMonthName(currentMonth)} ${currentYear}`;
    
        const dialog = document.getElementById("eventDialog");

        function CB(isevent) {
            document.getElementById('dialogEventTitle').innerHTML = isevent.description; // Set the title
            document.getElementById('dialogEventDate').innerHTML = "Date: " + isevent.date.split('T')[0]; // Set the date
            document.getElementById('dialogEventLocation').innerHTML = "Location: " + isevent.location; // Set the location

            let parts = document.getElementById('dialogEventParticipants'); // Set the participants
            parts.innerHTML = "Participants: ";
            isevent.participants.forEach(function(participant){ // Loop through the participants
                let li = document.createElement('li'); 
                li.innerHTML = participant; // Add the participant to the li element
                parts.appendChild(li); // Append the participant to the list
            })

            dialog.showModal(); 
            updateAction();
        }

        fetch('/events') // Fetch events
        .then(response => response.json()) 
        .then(events => {
            const dateButtons = document.querySelectorAll('.day button'); // Get all the date buttons

            dateButtons.forEach(button => {
            if(button.textContent != ''){
                const date = button.querySelector('time').getAttribute('datetime');
                const isevent = events.find(isevent => isevent.date && isevent.date.split('T')[0] == date);

                if (isevent) {
                    const root = document.documentElement;
                    button.classList.add('has-event');
                    button.style.borderColor = isevent.color;



                    // Definiamo una chiusura per memorizzare l'event listener corrente
                    const actualEventHandler = (function(isevent) {
                        return function(event) {
                            CB(isevent);
                        };
                    })(isevent);

                    // Rimuoviamo l'event listener precedente se esiste
                    if (button.eventListener) {
                        button.removeEventListener('click', button.eventListener);
                    }
                    button.addEventListener('click', actualEventHandler);
                    // Memorizziamo l'event listener associato al pulsante
                    button.eventListener = actualEventHandler;
                } else {
                    // Rimuoviamo l'event listener se il pulsante non ha un evento associato
                    if (button.eventListener) {
                        button.removeEventListener('click', button.eventListener);
                        delete button.eventListener; // Rimuoviamo il riferimento all'event listener dal pulsante
                    }
                    button.classList.remove('has-event');
                    button.style.borderColor = 'transparent';
                }       
            }
        });

        })
        .catch(error => console.error('Error loading events:', error)); // Handle any errors
    

        // Clear all components when the form is submitted/closed
        dialog.querySelector('form').onsubmit = function() {
            dialog.close();
        };
    }
  });

function updateAction(){
    let form = document.getElementById('form-event');
    if (!form)
        return;
    let user = '<%= username %>';
    let event_id = document.getElementById('dialogEventID').textContent;

    form.action = 'users/' + user + '/events/delete/' + event_id;
}