import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from 'wrtc';
import api from './api';

const wrtc = { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate };

api.seed.prototype.wrtc = wrtc;
api.peer.prototype.wrtc = wrtc;

export const seed = api.seed;
export const peer = api.peer;
