const { createClient } = require('redis');

const redisClient = createClient({
  url: `redis://${process.env.REDIS_HOST || 'cache'}:${process.env.REDIS_PORT || 6379}`,
});

redisClient.on('error', (err) => console.error('[Redis] Ошибка:', err));

async function initRedis() {
  await redisClient.connect();
  console.log('[Redis] Подключено');
}

module.exports = { redisClient, initRedis };