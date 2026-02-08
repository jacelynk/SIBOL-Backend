import { Request, Response } from 'express';
import { awardPointsForAccount } from '../services/qrService.js';
import { saveSensorData } from '../services/esp32Service.js';

// POST /api/esp32/weight
export async function receiveWeightData(req: Request, res: Response) {
    try {
        const { device_id, weight, timestamp, qr_code } = req.body as { 
            device_id?: string; 
            weight?: number; 
            timestamp?: number;
            qr_code?: string;
        };

        // Validate required fields
        if (!device_id || typeof device_id !== 'string') {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing or invalid device_id' 
            });
        }

        if (weight == null || !Number.isFinite(weight) || weight <= 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing or invalid weight (positive number expected)' 
            });
        }

        // Save sensor data first
        const sensorDataId = await saveSensorData({
            device_id,
            weight: Number(weight),
            timestamp: timestamp ? new Date(timestamp) : new Date(),
            qr_code: qr_code || null
        });

        // If QR code is provided, try to process it for points
        if (qr_code) {
            try {
                // Try to get account from QR code (assuming QR contains account ID or can be mapped)
                const accountId = await getAccountFromQrCode(qr_code);
                
                if (accountId) {
                    // Award points for the weight
                    const { awarded, totalPoints } = await awardPointsForAccount(
                        accountId, 
                        Number(weight), 
                        qr_code
                    );

                    // Update sensor data with account and points info
                    await updateSensorDataWithAccount(sensorDataId, accountId, awarded);

                    return res.status(200).json({
                        success: true,
                        message: 'Weight data processed and points awarded',
                        sensor_data_id: sensorDataId,
                        account_id: accountId,
                        weight: Number(weight),
                        points_awarded: awarded,
                        total_points: totalPoints
                    });
                } else {
                    return res.status(200).json({
                        success: true,
                        message: 'Weight data saved (no valid QR code found)',
                        sensor_data_id: sensorDataId,
                        weight: Number(weight),
                        points_awarded: 0
                    });
                }
            } catch (qrError: any) {
                console.error('QR processing error:', qrError);
                
                // Still save the sensor data even if QR processing fails
                return res.status(200).json({
                    success: true,
                    message: 'Weight data saved (QR processing failed)',
                    sensor_data_id: sensorDataId,
                    weight: Number(weight),
                    points_awarded: 0,
                    qr_error: qrError.message
                });
            }
        } else {
            // No QR code provided, just save sensor data
            return res.status(200).json({
                success: true,
                message: 'Weight data saved',
                sensor_data_id: sensorDataId,
                weight: Number(weight),
                points_awarded: 0
            });
        }

    } catch (err: any) {
        console.error('receiveWeightData error:', err);
        return res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
}

// Helper function to get account from QR code
async function getAccountFromQrCode(qrCode: string): Promise<number | null> {
    try {
        // First, try to get account from profile_tbl (if QR code is stored there)
        const db = require('../config/db').default;
        const [rows]: any = await db.execute(
            'SELECT Account_id FROM profile_tbl WHERE QR_code = ? LIMIT 1',
            [qrCode]
        );
        
        if (Array.isArray(rows) && rows.length > 0) {
            return rows[0].Account_id;
        }

        // If not found in profile_tbl, try to parse QR code as account ID directly
        const accountId = parseInt(qrCode);
        if (!isNaN(accountId) && accountId > 0) {
            // Verify account exists
            const [accountRows]: any = await db.execute(
                'SELECT Account_id FROM accounts_tbl WHERE Account_id = ? AND IsActive = 1 LIMIT 1',
                [accountId]
            );
            
            if (Array.isArray(accountRows) && accountRows.length > 0) {
                return accountId;
            }
        }

        return null;
    } catch (error) {
        console.error('Error getting account from QR code:', error);
        return null;
    }
}

// Helper function to update sensor data with account info
async function updateSensorDataWithAccount(sensorDataId: number, accountId: number, pointsAwarded: number): Promise<void> {
    try {
        const db = require('../config/db').default;
        await db.execute(
            `UPDATE esp32_sensor_data 
             SET account_id = ?, points_awarded = ?, is_processed = 1, processed_at = NOW()
             WHERE id = ?`,
            [accountId, pointsAwarded, sensorDataId]
        );
    } catch (error) {
        console.error('Error updating sensor data:', error);
        throw error;
    }
}
