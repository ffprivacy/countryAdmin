// dashboard.js
document.addEventListener('DOMContentLoaded', function() {
	
		const processList = document.getElementById('process-list');

    // Function to fetch processes asynchronously
    function fetchProcesses() {
        fetch('/get_processes')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            // Clear previous processes
            processList.innerHTML = '';
            // Update the DOM with fetched processes
            data.forEach(process => {
                const li = document.createElement('li');
                li.innerHTML = `id=${process.process_id} eco=${process.economic}, env=${process.environmental}, soc=${process.social}`;
                const form = document.createElement('form');
                form.setAttribute('action', '/select_process');
                form.setAttribute('method', 'POST');
                const checkbox = document.createElement('input');
                checkbox.setAttribute('type', 'checkbox');
                checkbox.setAttribute('name', 'selected');
                checkbox.setAttribute('value', process.selected);
                if (process.selected) {
                    checkbox.setAttribute('checked', '');
                }
                const idInput = document.createElement('input');
                idInput.setAttribute('type', 'number');
                idInput.setAttribute('name', 'id');
                idInput.setAttribute('value', process.id);
                idInput.setAttribute('hidden', '');
                form.appendChild(checkbox);
                form.appendChild(idInput);
                li.appendChild(form);
                processList.appendChild(li);
            });
        })
        .catch(error => {
            console.error('There was a problem fetching processes:', error.message);
            // Optionally, display an error message to the user
        });
    }

    // Fetch processes when the page loads
    fetchProcesses();
			
    // Submit button click event listener
    const submitBtns = document.querySelectorAll('.submit-btn');
    submitBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // Get the corresponding form
            const form = this.closest('form');
            if (form) {
                // Get form data
                const formData = new FormData(form);

                // Send form data asynchronously
                fetch(form.action, {
                    method: 'POST',
                    body: formData
                })
                .then(response => {
									if (!response.ok) {
			                throw new Error('Network response was not ok');
			            }
                })
                .then(data => {
                    console.log(data);
                    // Optionally handle response data
                })
                .catch(error => {
                    console.error('There was a problem with the fetch operation:', error);
                });
            }
        });
    });

    // Select form submission event listener
    const selectForms = document.querySelectorAll('.select-form');
    selectForms.forEach(form => {
        form.addEventListener('submit', function(event) {
            event.preventDefault();
            const formData = new FormData(this);
            fetch(this.action, {
                method: 'POST',
                body: formData
            })
            .then(response => {
                if (response.ok) {
                    return response.text();
                }
                throw new Error('Network response was not ok.');
            })
            .then(data => {
                console.log(data);
                // Optionally handle response data
            })
            .catch(error => {
                console.error('There was a problem with the fetch operation:', error);
            });
        });
    });
		
    const submitBtn = document.getElementById('submit-btn');
    const processForm = document.getElementById('process-form');

    submitBtn.addEventListener('click', function(event) {
	    	event.preventDefault();
			
        // Serialize form data
        const formData = new FormData(processForm);

        // Send form data asynchronously
        fetch(processForm.action, {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
						console.warn("done");
             fetchProcesses();
 						console.warn("dd");
            return response.text();
        })
        .then(data => {
            console.log('Process submitted successfully:', data);
            // Optionally, update the page with new data or display a success message
        })
        .catch(error => {
            console.error('There was a problem with the process submission:', error.message);
            // Optionally, display an error message to the user
        });
    });

});
