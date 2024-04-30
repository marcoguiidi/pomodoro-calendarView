document.addEventListener('DOMContentLoaded', function() {  // When the DOM is ready...
    const dialog = document.getElementById("eventDialog");

    fetch('../events') // Fetch events
      .then(response => response.json()) 
      .then(events => {
        const dateButtons = document.querySelectorAll('.day button'); // Get all the date buttons
        
        dateButtons.forEach(button => {
          const date = button.querySelector('time').getAttribute('datetime'); // Get the date from the button
          const event = events.find(event => event.date === date);  // Select event based on the date
          
          if (event) { // If the event matchsomething
            button.setAttribute('data-event-id', event._id);
            const root = document.documentElement;
            button.classList.add('has-event'); // Add the .has-event class
            button.style.borderColor = event.color; // Set the border color
            button.addEventListener('click', function() {
              
                document.getElementById('dialogEventTitle').innerHTML = event.description; // Set the title
                document.getElementById('dialogEventDate').innerHTML = "Date: " + event.date; // Set the date
                document.getElementById('dialogEventLocation').innerHTML = "Location: " + event.location; // Set the location
                let parts = document.getElementById('dialogEventParticipants'); // Set the participants
                parts.innerHTML = "Participants: ";
                event.participants.forEach(function(participant){ // Loop through the participants
                    let li = document.createElement('li'); 
                    li.innerHTML = participant; // Add the participant to the li element
                    parts.appendChild(li); // Append the participant to the list
                })

                dialog.showModal(); 
            });
          }
        });
      })
      .catch(error => console.error('Error loading events:', error)); // Handle any errors
      
  
    // Close the dialog when the form is submitted/closed
    // Clear all components when the form is submitted/closed
    dialog.querySelector('form').onsubmit = function() {
        dialog.close();
    };
  });

