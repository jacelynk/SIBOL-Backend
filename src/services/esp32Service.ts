import db from '../config/db';

export interface SensorDataInput {
    device_id: string;
    weight: number;
    timestamp: Date;
    qr_code?: string | null;
}

export async function saveSensorData(data: SensorDataInput): Promise<number> {
    try {
        const [result]: any = await db.execute(
            `INSERT INTO esp32_sensor_data (device_id, weight, created_at, qr_code) 
             VALUES (?, ?, ?, ?)`,
            [data.device_id, data.weight, data.timestamp, data.qr_code]
        );
        
        return result.insertId;
    } catch (error) {
        console.error('Error saving sensor data:', error);
        throw new Error('Failed to save sensor data');
    }
}

export async function getSensorDataByDevice(deviceId: string, limit: number = 100): Promise<any[]> {
    try {
        const [rows]: any = await db.execute(
            `SELECT * FROM esp32_sensor_data 
             WHERE device_id = ? 
             ORDER BY created_at DESC 
             LIMIT ?`,
            [deviceId, limit]
        );
        
        return Array.isArray(rows) ? rows : [];
    } catch (error) {
        console.error('Error getting sensor data:', error);
        throw new Error('Failed to retrieve sensor data');
    }
}

export async function getUnprocessedSensorData(): Promise<any[]> {
    try {
        const [rows]: any = await db.execute(
            `SELECT * FROM esp32_sensor_data 
             WHERE is_processed = 0 AND qr_code IS NOT NULL
             ORDER BY created_at ASC`
        );
        
        return Array.isArray(rows) ? rows : [];
    } catch (error) {
        console.error('Error getting unprocessed sensor data:', error);
        throw new Error('Failed to retrieve unprocessed sensor data');
    }
}

export async function markSensorDataAsProcessed(sensorDataId: number, accountId: number, pointsAwarded: number): Promise<void> {
    try {
        await db.execute(
            `UPDATE esp32_sensor_data 
             SET account_id = ?, points_awarded = ?, is_processed = 1, processed_at = NOW()
             WHERE id = ?`,
            [accountId, pointsAwarded, sensorDataId]
        );
    } catch (error) {
        console.error('Error marking sensor data as processed:', error);
        throw new Error('Failed to update sensor data');
    }
}

export async function getSensorDataStats(deviceId?: string): Promise<any> {
    try {
        let query = `
            SELECT 
                COUNT(*) as total_readings,
                AVG(weight) as avg_weight,
                MIN(weight) as min_weight,
                MAX(weight) as max_weight,
                SUM(CASE WHEN is_processed = 1 THEN 1 ELSE 0 END) as processed_readings,
                SUM(CASE WHEN points_awarded > 0 THEN points_awarded ELSE 0 END) as total_points_awarded
            FROM esp32_sensor_data
        `;
        
        const params: any[] = [];
        
        if (deviceId) {
            query += ' WHERE device_id = ?';
            params.push(deviceId);
        }
        
        const [rows]: any = await db.execute(query, params);
        
        return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error('Error getting sensor data stats:', error);
        throw new Error('Failed to retrieve sensor data statistics');
    }
}
