import shortid from 'shortid';

export default function(consumerId, providerId, data = '') {
  return { rid: shortid.generate(), consumerId, providerId, data };
}
