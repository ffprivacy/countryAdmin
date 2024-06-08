function setupExportDatabaseElement(e) {
    e.addEventListener('click', function() {
        window.location.href = '/export_database';
    });
}
function setupImportDatabaseElement(e) {
    e.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            const formData = new FormData();
            formData.append('file', file);
    
            fetch('/import_database', {
                method: 'POST',
                body: formData
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    alert('Database imported successfully. Please refresh the page.');
                } else {
                    alert('Failed to import database.');
                }
            })
            .catch(error => {
                console.error('There was a problem importing the database:', error.message);
            });
        }
    });
}