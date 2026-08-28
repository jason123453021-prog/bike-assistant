import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('bike_assistant.db');

export const initDatabase = async () => {
  try {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS track_points (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ride_id TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        altitude REAL,
        speed REAL,
        timestamp INTEGER NOT NULL
      );
    `);
  } catch (error) { console.error('DB Init Error:', error); }
};

export const insertTrackPoint = async (rideId: string, lat: number, lng: number, alt: number | null, speed: number | null, timestamp: number) => {
  try {
    await db.runAsync(
      `INSERT INTO track_points (ride_id, latitude, longitude, altitude, speed, timestamp) VALUES (?, ?, ?, ?, ?, ?)`,
      [rideId, lat, lng, alt, speed, timestamp]
    );
  } catch (error) { console.error('Insert Point Error:', error); }
};

export const getTrackPointsByRideId = async (rideId: string) => {
  try {
    return await db.getAllAsync(
      `SELECT latitude, longitude FROM track_points WHERE ride_id = ? ORDER BY timestamp ASC`,
      [rideId]
    ) as { latitude: number; longitude: number }[];
  } catch (error) { return []; }
};
