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
						// Calculate total metrics for each kind in the selected governance
		        const selectedProcesses = data.filter(process => process.selected);
		        const totalEconomic = selectedProcesses.reduce((total, process) => total + process.economic, 0);
		        const totalEnvironmental = selectedProcesses.reduce((total, process) => total + process.environmental, 0);
		        const totalSocial = selectedProcesses.reduce((total, process) => total + process.social, 0);

		        // Update total metrics in the HTML
		        document.getElementById('total-economic').textContent = `Total Economic Impact: ${totalEconomic}`;
		        document.getElementById('total-environmental').textContent = `Total Environmental Impact: ${totalEnvironmental}`;
		        document.getElementById('total-social').textContent = `Total Social Impact: ${totalSocial}`;
					
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
								
								checkbox.addEventListener('click',function(e){
									form.submit();
								});
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

		function attachSelectedEvent() {
	    // Select form submission event listener
	    const selectForms = document.querySelectorAll('.select-form');
	    selectForms.forEach(form => {
	        form.addEventListener('submit', function(event) {
	            event.preventDefault();
	            event.stopPropagation(); // Prevent other event handlers from being called
							
	            const formData = new FormData(this);
	            fetch(this.action, {
	                method: 'POST',
	                body: formData
	            })
	            .then(response => {
	                if (response.ok) {
			              fetchProcesses();
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
		}
		
		attachSelectedEvent();
		
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
             fetchProcesses();
            return response.text();
        })
        .then(data => {
            console.log('Process submitted successfully:', data);
						attachSelectedEvent();
            // Optionally, update the page with new data or display a success message
        })
        .catch(error => {
            console.error('There was a problem with the process submission:', error.message);
            // Optionally, display an error message to the user
        });
    });

});
