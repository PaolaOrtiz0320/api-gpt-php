document.addEventListener("DOMContentLoaded", function () {
    // Obtener referencias a los elementos del DOM
    const startBtn = document.getElementById("startBtn");
    const outputText = document.getElementById("outputText");
    let recognition; // Objeto para el reconocimiento de voz
    let escuchando = false; // Estado del reconocimiento de voz

    const ordenPrefijo = "WILLY"; // Prefijo que debe iniciar cada comando

    // Verificar si el navegador soporta el reconocimiento de voz
    if ("webkitSpeechRecognition" in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true; // Mantener el reconocimiento activado
        recognition.lang = "es-ES"; // Configurar idioma en español
        recognition.interimResults = false; // Solo resultados finales

        // Evento cuando el reconocimiento de voz comienza
        recognition.onstart = function () {
            escuchando = true;
            startBtn.disabled = true; // Deshabilitar botón mientras se escucha
        };

        // Evento cuando el reconocimiento de voz se detiene
        recognition.onend = function () {
            escuchando = false;
            startBtn.disabled = false; // Habilitar botón nuevamente
        };

        // Evento cuando se detecta un resultado de voz
        recognition.onresult = function (event) {
            let transcript = event.results[event.results.length - 1][0].transcript.toUpperCase().trim();
            console.log("Escuché:", transcript);

            // Verificar si el comando empieza con el prefijo "WILLY"
            if (!transcript.startsWith(ordenPrefijo)) {
                outputText.innerText = `Comenzar la orden con '${ordenPrefijo}'`;
                return;
            }

            // Extraer la orden eliminando el prefijo
            let comando = transcript.replace(ordenPrefijo, "").trim();
            enviarComando(ordenPrefijo + " " + comando); // Enviar la orden al backend
        };
    }

    // Función para enviar la orden reconocida al servidor
    function enviarComando(comando) {
        fetch("http://3.80.159.60/api-gpt-php/endpoints/chat.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: comando })
        })
        .then(response => response.text()) // Obtener la respuesta en texto para depuración
        .then(data => {
            console.log("Respuesta cruda del servidor:", data);
            try {
                let jsonData = JSON.parse(data); // Convertir respuesta a JSON
                let respuesta = jsonData.status === 200 ? jsonData.data.reply : "Error en la respuesta";
                outputText.innerText = respuesta; // Mostrar respuesta en la interfaz

                // Si la respuesta es una despedida, detener reconocimiento y habilitar botón
                if (respuesta.toLowerCase().includes("hasta luego") || respuesta.toLowerCase().includes("adiós")) {
                    if (recognition) recognition.stop();
                    startBtn.disabled = false;
                }
            } catch (error) {
                outputText.innerText = "Error de formato en la respuesta";
                console.error("Error de JSON:", error, "Respuesta:", data);
            }
        })
        .catch(error => {
            outputText.innerText = "Error de conexión";
            console.error("Error:", error);
        });
    }

    // Evento para iniciar el reconocimiento de voz cuando se presiona el botón
    startBtn.addEventListener("click", function () {
        if (!escuchando && recognition) {
            recognition.start();
        }
    });

    // Evento para activar el reconocimiento de voz con la tecla Enter
    document.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            startBtn.click();
        }
    });
});
