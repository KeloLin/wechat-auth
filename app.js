// @ts-nocheck
'use strict';

module.exports = app => {
  app.beforeStart(async () => {
    const redis = app.redis.get('redis');
    // fetch all appid & secret
    app.config.wechat.appConf = app.config.wechat.appConf || {};
    const apps = app.config.wechat.apps || [];

    const result = await Promise.all(apps.map(a => {
      return redis.hgetall(`${a}:appsecret`);
    }));
    apps.forEach((a, i) => {
      if (result[i]) {
        app.config.wechat.appConf[a] = result[i];
      }
    });
    app.config.authtoken = await redis.get('app:authtoken');

    const adminsStr = await redis.get('yiz:admins');
    if (adminsStr) {
      const admins = JSON.parse(adminsStr);
      app.config.presetAdmins = admins.reduce((pre, cur) => {
        pre[`${cur.period}-${cur.mobile}`] = cur;
        return pre;
      }, {});
    }


    // do not use in production
    redis.defineCommand('phgetall', {
      lua: `
      local collate = function (key)
        local raw_data = redis.call('HGETALL', key)
        local hash_data = {}
        for idx = 1, #raw_data, 2 do
          hash_data[raw_data[idx]] = raw_data[idx + 1]
        end
        return hash_data;
      end

      local data = {}
      for _,k in ipairs(redis.call('keys', ARGV[1])) do
        if redis.pcall('TYPE', k).ok == 'hash' then
          data[k] = collate(k)
        end
      end
      return cjson.encode(data)
      `,
    });

    // do not use in production
    redis.defineCommand('pget', {
      lua: `
        local data = {}
        for _,k in ipairs(redis.call('keys', ARGV[1])) do
          if redis.pcall('TYPE', k).ok == 'string' then
            data[k] = redis.call('GET', k)
          end
        end
        return cjson.encode(data)
      `,
    });
  });
};
