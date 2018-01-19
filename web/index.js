import './adapter';
import api from '../src/api';

const wrtc = { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate };

api.seed.prototype.wrtc = wrtc;
api.peer.prototype.wrtc = wrtc;

export const seed = api.seed;
export const peer = api.peer;
