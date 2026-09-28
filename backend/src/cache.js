const { redisClient } = require('./redis');

const PRODUCTS_CACHE_KEY = 'products:all';
const PRODUCTS_CACHE_TTL = 60; // секунд

// Middleware: отдаём из кэша, если есть
function cacheProductsList(req, res, next) {
  redisClient
    .get(PRODUCTS_CACHE_KEY)
    .then((cached) => {
      if (cached) {
        console.log('[Cache] HIT', PRODUCTS_CACHE_KEY);
        return res.json({
          source: 'cache',
          data: JSON.parse(cached),
        });
      }
      console.log('[Cache] MISS', PRODUCTS_CACHE_KEY);
      next();
    })
    .catch((err) => {
      console.error('[Cache] Ошибка чтения:', err);
      next(); // при сбое кэша просто идём в БД
    });
}

// Сохраняем данные в кэш с TTL
async function saveProductsToCache(data) {
  try {
    await redisClient.set(PRODUCTS_CACHE_KEY, JSON.stringify(data), {
      EX: PRODUCTS_CACHE_TTL,
    });
  } catch (err) {
    console.error('[Cache] Ошибка записи:', err);
  }
}

// Инвалидация кэша — вызывается при создании/изменении/удалении
async function invalidateProductsCache() {
  try {
    await redisClient.del(PRODUCTS_CACHE_KEY);
    console.log('[Cache] INVALIDATE', PRODUCTS_CACHE_KEY);
  } catch (err) {
    console.error('[Cache] Ошибка инвалидации:', err);
  }
}

module.exports = {
  cacheProductsList,
  saveProductsToCache,
  invalidateProductsCache,
  PRODUCTS_CACHE_KEY,
  PRODUCTS_CACHE_TTL,
};