// dashboard.js
document.addEventListener('DOMContentLoaded', function() {
	
		const processList = document.getElementById('process-list');

		function selectProcesses() {
			const economicGoal = parseInt(document.getElementById('economic-goals').value, 10);
			const govGoalEnvEmissions = parseInt(document.getElementById('governance-goals-env-emissions').value, 10);
			const socialGoal = parseInt(document.getElementById('social-goals').value, 10);

        const allProcesses = [...processList.getElementsByTagName('li')].map(li => {
            const form = li.querySelector('form');
            const checkbox = form.querySelector('input[name="selected"]');
            const id = parseInt(form.querySelector('input[name="id"]').value);
			const processId = parseInt(li.getAttribute("process-id"));
			const economic = parseInt(li.getAttribute("economic"));
			const envEmissions = parseInt(li.getAttribute("env-emissions"));
			const social = parseInt(li.getAttribute("social"));
			const amount = parseInt(li.getAttribute("process-amount"));
            return { id, processId, economic, envEmissions, social, selected: checkbox.checked, amount, form };
        });

        // Unselect all processes
        allProcesses.forEach(process => {
            process.selected = false;
            process.form.querySelector('input[name="selected"]').checked = false;
        });

        // Group processes by process_id
        const processMap = new Map();
        allProcesses.forEach(process => {
            if (!processMap.has(process.processId)) {
                processMap.set(process.processId, []);
            }
            processMap.get(process.processId).push(process);
        });

        let totalEconomic = 0;
        let selectedGovEnvEmissions = 0;
        let totalSocial = 0;
       
		// Calculate the distance between each process and the goals
		const calculateDistance = (process, goalEconomic, goalEnvEmissions, goalSocial) => {
			const distanceEconomic = Math.abs(process.amount * process.economic - goalEconomic);
			const distanceEnvEmissions = Math.abs(process.amount * process.envEmissions - goalEnvEmissions);
			const distanceSocial = Math.abs(process.amount * process.social - goalSocial);
			return distanceEconomic + distanceEnvEmissions + distanceSocial;
		};

		// Select processes based on goals
		const selectedProcessIds = new Set();
		processMap.forEach(processes => {
			let minDistance = Infinity;
			let closestProcess = null;
			for (const process of processes) {
				if (!selectedProcessIds.has(process.processId)) {
					const distance = calculateDistance(process, economicGoal - totalEconomic, govGoalEnvEmissions - selectedGovEnvEmissions, socialGoal - totalSocial);
					if (distance < minDistance) {
						minDistance = distance;
						closestProcess = process;
					}
				}
			}
			if (closestProcess) {
				closestProcess.selected = true;
				selectedProcessIds.add(closestProcess.processId);
				totalEconomic += closestProcess.economic * closestProcess.amount;
				selectedGovEnvEmissions += closestProcess.envEmissions * closestProcess.amount;
				totalSocial += closestProcess.social * closestProcess.amount;
			}
		});
		
		const formData = new FormData();
		allProcesses.forEach(process => {
			formData.append('id[]', process.id);
			formData.append('selected[]', process.selected);
		});

		var p = fetch('/select_process', {
			method: 'POST',
			body: formData
		})
        p
            .then(() => fetchProcesses())
            .catch(function(e){
            	console.warn(e);
            });
    }
		
		document.getElementById("btn-adjust").addEventListener("click",selectProcesses)
			
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
		        const totalEconomic = selectedProcesses.reduce((total, process) => total + process.economic * process.amount, 0);
		        const selectedGovEnvEmissions = selectedProcesses.reduce((total, process) => total + process.envEmissions * process.amount, 0);
		        const totalSocial = selectedProcesses.reduce((total, process) => total + process.social * process.amount, 0);

		        // Update total metrics in the HTML
		        document.getElementById('total-economic').textContent = `${totalEconomic}`;
		        document.getElementById('selected-governance-env-emissions').textContent = `${selectedGovEnvEmissions}`;
		        document.getElementById('total-social').textContent = `${totalSocial}`;
					
            // Clear previous processes
            processList.innerHTML = '';
            // Update the DOM with fetched processes
            data.forEach(process => {
                const li = document.createElement('li');
				li.setAttribute("process-id",process.process_id);
				li.setAttribute("economic",process.economic);
				li.setAttribute("env-emissions",process.envEmissions);
				li.setAttribute("social",process.social);
				li.setAttribute("title",process.title);
				li.setAttribute("process-amount",process.amount);
                li.innerHTML = `${process.process_id}: ${process.title} ${process.economic}$ ${process.envEmissions}kgCO2eq ${process.social} social X ${process.amount}`;
                const form = document.createElement('form');
                form.setAttribute('action', '/select_process');
                form.setAttribute('method', 'POST');
                const checkbox = document.createElement('input');
                checkbox.setAttribute('type', 'checkbox');
                checkbox.setAttribute('value', process.selected);
                if (process.selected) {
                    checkbox.setAttribute('checked', '');
                }
                const checkboxS = document.createElement('input');
                checkboxS.setAttribute('type', 'number');
                checkboxS.setAttribute('name', 'selected');
                checkboxS.setAttribute('hidden', '');

                const idInput = document.createElement('input');
                idInput.setAttribute('type', 'number');
                idInput.setAttribute('name', 'id');
                idInput.setAttribute('value', process.id);
                idInput.setAttribute('hidden', '');
                form.appendChild(checkbox);
                form.appendChild(idInput);
				form.appendChild(checkboxS);
                li.appendChild(form);
                processList.appendChild(li);
								
				checkbox.addEventListener('click',function(e){									
					checkboxS.value = checkbox.checked ? 1 : 0;
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
		
		document.getElementById('export-btn').addEventListener('click', function() {
	      fetch('/get_processes')
	      .then(response => {
	          if (!response.ok) {
	              throw new Error('Network response was not ok');
	          }
	          return response.json();
	      })
	      .then(data => {
	          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
	          const url = URL.createObjectURL(blob);
	          const a = document.createElement('a');
	          a.href = url;
	          a.download = 'processes.json';
	          document.body.appendChild(a);
	          a.click();
	          document.body.removeChild(a);
	          URL.revokeObjectURL(url);
					})
	  });

	  // Import button functionality
	  document.getElementById('import-btn').addEventListener('click', function() {
	      const importFile = document.getElementById('import-file').files[0];
	      if (importFile) {
	          const reader = new FileReader();
	          reader.onload = function(event) {
	              const processes = JSON.parse(event.target.result);
					for(let process of processes) {
					// Serialize form data
					const formData = new FormData();
					formData.append('economic', process.economic);
					formData.append('envEmissions', process.envEmissions);
					formData.append('process_id', process.process_id);
					formData.append('title', process.title);
					formData.append('social', process.social);
					formData.append('selected', process.selected);
					formData.append('amount', process.amount);
																			
					// Send form data asynchronously
					fetch("/dashboard", {
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
				}
	          };
	          reader.readAsText(importFile);
	      }
	  });

});
