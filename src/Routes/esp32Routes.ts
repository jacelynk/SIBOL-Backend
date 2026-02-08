import { Router } from 'express';
import { receiveWeightData } from '../controllers/esp32Controller.js';

const router = Router();

// POST /api/esp32/weight - Receive weight data from ESP32
router.post('/weight', receiveWeightData);

export default router;
