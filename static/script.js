// script.js

(function() {
    // Connect to the SocketIO server
    const socket = io();

    // Variables for Weather API
    const lat = 50.2807;  
    const lon = -30.3445; 
    const weatherAPIKey = '';
    const city = '';
    const units = ''; // Use 'imperial' for Fahrenheit

    // Fetch initial messages from the server
    async function fetchMessages() {
        try {
            const response = await fetch('/get_messages');
            const messages = await response.json();

            document.getElementById('textarea-1').value = messages[1] || ''; // Person 1
            document.getElementById('textarea-2').value = messages[2] || ''; // Person 2
            document.getElementById('textarea-3').value = messages[3] || ''; // Person 3
        } catch (error) {
            console.error("Error fetching messages:", error);
        }
    }

    // Save the message when a user types
    function saveMessage(id, message) {
        console.log(`Saving message for ID ${id}: ${message}`); // Debugging log
        socket.emit('save_message', {
            id: id,
            message: message
        });
    }

    // Attach event listeners to the textareas
    function attachEventListeners() {
        const textarea1 = document.getElementById('textarea-1');
        const textarea2 = document.getElementById('textarea-2');
        const textarea3 = document.getElementById('textarea-3');

        if (textarea1) {
            textarea1.addEventListener('input', function() {
                window.requestAnimationFrame(() => {
                    saveMessage(1, this.value);  // Save for Person 1
                });
            });
        }

        if (textarea2) {
            textarea2.addEventListener('input', function() {
                window.requestAnimationFrame(() => {
                    saveMessage(2, this.value);  // Save for Person 2
                });
            });
        }

        if (textarea3) {
            textarea3.addEventListener('input', function() {
                window.requestAnimationFrame(() => {
                    saveMessage(3, this.value);  // Save for Person 3
                });
            });
        }
    }

    // Listen for message updates from the server
    socket.on('update_message', function(data) {
        console.log('Update received:', data); // Debugging log
        const textareaId = `textarea-${data.id}`;
        const textarea = document.getElementById(textareaId);
        if (textarea) {
            textarea.value = data.message;  // Update the relevant textarea with the new message
        }
    });

    // Ping to keep WebSocket alive
    setInterval(() => {
        socket.emit('ping');  // Keep WebSocket connection alive
    }, 50000);  // Ping every 50 seconds

    async function fetchCurrentWeather() {
        console.log('Fetching current weather data...');
        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=${units}&appid=${weatherAPIKey}`;
        try {
            const response = await fetch(weatherUrl);
            const data = await response.json();
            console.log('Current Weather Data:', data);
    
            // Handle errors
            if (!response.ok) {
                console.error('Error fetching current weather data:', data.message);
                document.getElementById('temperature').innerHTML = 'Error fetching weather data';
                document.getElementById('weather-description').innerHTML = '';
                document.getElementById('humidity').innerHTML = '';
                document.getElementById('wind-speed').innerHTML = '';
                document.getElementById('weather-icon').src = '';
                return;
            }
    
            // Extract relevant data
            const temperature = data.main.temp;
            const roundedTemperature = Math.round(temperature); // Round the temperature to the nearest integer
            const weatherDescription = data.weather[0].description;
            const humidity = data.main.humidity;
            const windSpeed = data.wind.speed;
            const icon = data.weather[0].icon;
    
            // Update the HTML
            document.getElementById('temperature').innerHTML = `${roundedTemperature}°C`;
            document.getElementById('weather-description').innerHTML = `${weatherDescription}`;
            document.getElementById('humidity').innerHTML = `Humidity: ${humidity}%`;
            document.getElementById('wind-speed').innerHTML = `Wind Speed: ${windSpeed} m/s`;
    
            // Display the weather icon
            const weatherIconUrl = `http://openweathermap.org/img/wn/${icon}@2x.png`;
            document.getElementById('weather-icon').src = weatherIconUrl;
    
            // Fetch UV Index after getting the current weather (since we need lat/lon)
            fetchUVIndex(data.coord.lat, data.coord.lon);
    
        } catch (error) {
            console.error('Error fetching current weather data:', error);
            document.getElementById('temperature').innerHTML = 'Error fetching weather data';
            document.getElementById('weather-description').innerHTML = '';
            document.getElementById('humidity').innerHTML = '';
            document.getElementById('wind-speed').innerHTML = '';
            document.getElementById('weather-icon').src = '';
        }
    }
    

    // Fetch UV index using the new API endpoint
    async function fetchUVIndex(lat, lon) {
        console.log('Fetching UV Index data...');
        const uvUrl = `https://api.openweathermap.org/data/2.5/uvi?lat=${lat}&lon=${lon}&appid=${weatherAPIKey}`;
        try {
            const response = await fetch(uvUrl);
            const uvData = await response.json();
            console.log('UV Index Data:', uvData);

            if (!response.ok) {
                console.error('Error fetching UV Index:', uvData.message);
                document.getElementById('uv-index').innerHTML = 'Error fetching UV index';
                return;
            }

            document.getElementById('uv-index').innerHTML = `UV Index: ${uvData.value}`;
        } catch (error) {
            console.error('Error fetching UV index:', error);
            document.getElementById('uv-index').innerHTML = 'Error fetching UV index';
        }
    }

    // Fetch messages and weather when the page loads
    window.onload = function() {
        fetchMessages().then(() => {
            attachEventListeners();
            attachFontSizeEventListeners();
        });
        fetchCurrentWeather();
        setInterval(fetchCurrentWeather, 600000); // Refresh weather every 10 minutes
    };

    function attachFontSizeEventListeners() {
        const fontButtons = document.querySelectorAll('.font-button');
    
        fontButtons.forEach(button => {
            button.addEventListener('click', function() {
                const textareaId = this.getAttribute('data-textarea');
                const textarea = document.getElementById(textareaId);
                const action = this.classList.contains('increase-font') ? 'increase' : 'decrease';
    
                // Get current font size
                const currentFontSize = parseFloat(window.getComputedStyle(textarea, null).getPropertyValue('font-size'));
                let newFontSize;
    
                if (action === 'increase') {
                    newFontSize = currentFontSize + 2;
                } else {
                    newFontSize = currentFontSize - 2;
                }
    
                // Limit font size
                if (newFontSize < 10) {
                    newFontSize = 10; // Minimum font size
                }
                if (newFontSize > 72) {
                    newFontSize = 72; // Maximum font size
                }
    
                // Apply new font size
                textarea.style.fontSize = newFontSize + 'px';
    
                // Save the new font size to the server
                saveFontSize(textareaId, newFontSize);
            });
        });
    }
    
    // Function to save font size via Socket.IO
    function saveFontSize(textareaId, fontSize) {
        const id = textareaId.split('-')[1]; // Extract ID (1, 2, 3)
        console.log(`Saving font size for ID ${id}: ${fontSize}`);
        socket.emit('save_font_size', {
            id: id,
            fontSize: fontSize
        });
    }
    
    // Listen for font size updates from the server
    socket.on('update_font_size', function(data) {
        console.log('Font size update received:', data);
        const textareaId = `textarea-${data.id}`;
        const textarea = document.getElementById(textareaId);
        if (textarea) {
            textarea.style.fontSize = data.fontSize + 'px';
        }
    });
    
    // Modify fetchMessages to also apply font sizes
    async function fetchMessages() {
        try {
            const response = await fetch('/get_messages');
            const data = await response.json();
    
            const messages = data.messages;
            const fontSizes = data.font_sizes;
    
            for (let id in messages) {
                const textarea = document.getElementById(`textarea-${id}`);
                if (textarea) {
                    textarea.value = messages[id] || '';
                    const fontSize = fontSizes[id];
                    if (fontSize) {
                        textarea.style.fontSize = fontSize + 'px';
                    } else {
                        textarea.style.fontSize = '16px'; // Default font size
                    }
                }
            }
        } catch (error) {
            console.error("Error fetching messages:", error);
        }
    }
})();
