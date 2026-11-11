const supabase = require('./supabase');

const COLLECTIONS = {
    users: 'users',
    advertisers: 'advertisers',
    partners: 'partners',
    vehicles: 'vehicles',
    devices: 'devices',
    campaigns: 'campaigns',
    inventory: 'inventory',
    billing: 'billing',
    support: 'support',
    audit: 'audit_logs',
    logins: 'logins'
};

async function readTable(table) {
    const { data, error } = await supabase
        .from(table)
        .select('id, payload');

    if (error) throw new Error(`${table}: ${error.message}`);

    return (data || []).map(row => row.payload);
}

async function loadDatabase() {
    const db = {};

    for (const [key, table] of Object.entries(COLLECTIONS)) {
        db[key] = await readTable(table);
    }

    const settings = await readTable('app_settings');

    db.settings =
        settings.find(item => item.id === 'settings')?.value || {};

    db.meta =
        settings.find(item => item.id === 'meta')?.value || {};

    const hasData = Object.values(COLLECTIONS)
        .some((table, index) =>
            db[Object.keys(COLLECTIONS)[index]].length > 0
        );

    return hasData ? db : null;
}

async function saveTable(table, records) {
    const { data: existing, error: readError } = await supabase
        .from(table)
        .select('id');

    if (readError) throw new Error(`${table}: ${readError.message}`);

    const rows = records.map(record => {
        if (record.id === undefined || record.id === null) {
            throw new Error(`A record in ${table} is missing its id`);
        }

        return {
            id: String(record.id),
            payload: record
        };
    });

    const currentIds = rows.map(row => row.id);
    const oldIds = (existing || []).map(row => row.id);
    const deletedIds = oldIds.filter(id => !currentIds.includes(id));

    if (deletedIds.length > 0) {
        const { error } = await supabase
            .from(table)
            .delete()
            .in('id', deletedIds);

        if (error) throw new Error(`${table}: ${error.message}`);
    }

    if (rows.length > 0) {
        const { error } = await supabase
            .from(table)
            .upsert(rows, { onConflict: 'id' });

        if (error) throw new Error(`${table}: ${error.message}`);
    }
}

async function saveDatabase(db) {
    for (const [key, table] of Object.entries(COLLECTIONS)) {
        await saveTable(table, db[key] || []);
    }

    const settingsRows = [
        { id: 'settings', value: db.settings || {} },
        { id: 'meta', value: db.meta || {} }
    ].map(item => ({
        id: item.id,
        payload: item
    }));

    const { error } = await supabase
        .from('app_settings')
        .upsert(settingsRows, { onConflict: 'id' });

    if (error) throw new Error(`app_settings: ${error.message}`);

    console.log('Database saved to Supabase successfully');
}

async function initializeDatabase(initialDatabase) {
    const storedDatabase = await loadDatabase();

    if (storedDatabase) {
        console.log('Loading existing data from Supabase');
        return storedDatabase;
    }

    console.log('Supabase is empty. Migrating existing data...');

    await saveDatabase(initialDatabase);

    return initialDatabase;
}

module.exports = {
    initializeDatabase,
    saveDatabase
};