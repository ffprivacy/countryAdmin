// dashboard.js

console.warn("ok");

document.addEventListener('DOMContentLoaded', function() {
    // Submit button click event listener
    const submitBtns = document.querySelectorAll('.submit-btn');
    submitBtns.forEach(btn => {
			console.warn(btn);
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
});
