const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Inicializar Base de Datos SQLite
const db = new sqlite3.Database('./rifas.db', (err) => {
    if (err) console.error("Error al conectar SQLite:", err);
    else console.log("Base de datos SQLite conectada correctamente.");
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS boletos (
        numero TEXT PRIMARY KEY,
        estado TEXT DEFAULT 'disponible',
        nombre TEXT DEFAULT '',
        telefono TEXT DEFAULT '',
        timestamp INTEGER DEFAULT 0
    )`);

    for (let i = 1; i <= 100; i++) {
        const numStr = i.toString().padStart(3, '0');
        db.run(`INSERT OR IGNORE INTO boletos (numero, estado, timestamp) VALUES (?, 'disponible', 0)`, [numStr]);
    }
});

// Limpieza automática de apartados después de 24 horas
setInterval(() => {
    const ahora = Date.now();
    const limite24h = 24 * 60 * 60 * 1000;
    db.run(`UPDATE boletos SET estado = 'disponible', nombre = '', telefono = '', timestamp = 0 WHERE estado = 'apartado' AND (? - timestamp) > ?`, [ahora, limite24h]);
}, 60000);

// Rutas de API
app.get('/api/boletos', (req, res) => {
    db.all(`SELECT * FROM boletos`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const result = {};
        rows.forEach(row => {
            result[row.numero] = row;
        });
        res.json(result);
    });
});

app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) res.json({ success: true });
    else res.status(401).json({ success: false, message: "Contraseña incorrecta" });
});

app.post('/api/admin/actualizar', (req, res) => {
    const { password, numero, estado, nombre, telefono } = req.body;
    if (password !== ADMIN_PASSWORD) return res.status(401).json({ success: false });

    const ts = estado === 'apartado' ? Date.now() : 0;
    db.run(`UPDATE boletos SET estado = ?, nombre = ?, telefono = ?, timestamp = ? WHERE numero = ?`, 
        [estado, nombre || '', telefono || '', ts, numero], 
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

app.listen(PORT, () => console.log(`Servidor iniciado en puerto ${PORT}`));
