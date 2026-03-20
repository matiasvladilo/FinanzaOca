require('dotenv').config();

const express = require('express');

const app = express();
app.use(express.json());

app.use('/test',            require('./routes/test'));
app.use('/generate-report', require('./routes/report'));
app.use('/send-email',      require('./routes/email'));
app.use('/cron',            require('./routes/cron'));

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`FinanzaOca backend corriendo en puerto ${PORT}`);
});
