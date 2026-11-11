const supabase = require('./supabase');

async function testConnection() {
    try {
        const { data, error } = await supabase
            .from('advertisers')
            .select('id')
            .limit(1);

        if (error) {
            throw error;
        }

        console.log('Supabase connection successful!');
        console.log('Advertisers test result:', data);

    } catch (error) {
        console.error('Supabase connection failed:', error.message);
        process.exitCode = 1;
    }
}

testConnection();