/**
 * 房間管理 Store 單元測試
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useRoomStore } from './room'
import type { RoomInfo } from '../types/room'

// Mock $fetch
vi.mock('#app', () => ({
  $fetch: vi.fn()
}))

describe('Room Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const store = useRoomStore()
      
      expect(store.currentRoom).toBeNull()
      expect(store.currentPlayerId).toBeNull()
      expect(store.currentPlayerName).toBeNull()
      expect(store.isLoading).toBe(false)
      expect(store.error).toBeNull()
    })
  })

  describe('Getters', () => {
    it('isInRoom should return false when no room', () => {
      const store = useRoomStore()
      expect(store.isInRoom).toBe(false)
    })

    it('isInRoom should return true when in room', () => {
      const store = useRoomStore()
      store.currentRoom = {
        roomId: 'test-room',
        hostId: 'player1',
        players: [],
        isPasswordProtected: false,
        maxPlayers: 6
      }
      expect(store.isInRoom).toBe(true)
    })

    it('isHost should return true when player is host', () => {
      const store = useRoomStore()
      store.currentPlayerId = 'player1'
      store.currentRoom = {
        roomId: 'test-room',
        hostId: 'player1',
        players: [{ id: 'player1', name: 'Host', isHost: true }],
        isPasswordProtected: false,
        maxPlayers: 6
      }
      expect(store.isHost).toBe(true)
    })

    it('isHost should return false when player is not host', () => {
      const store = useRoomStore()
      store.currentPlayerId = 'player2'
      store.currentRoom = {
        roomId: 'test-room',
        hostId: 'player1',
        players: [
          { id: 'player1', name: 'Host', isHost: true },
          { id: 'player2', name: 'Player', isHost: false }
        ],
        isPasswordProtected: false,
        maxPlayers: 6
      }
      expect(store.isHost).toBe(false)
    })

    it('playerCount should return correct count', () => {
      const store = useRoomStore()
      store.currentRoom = {
        roomId: 'test-room',
        hostId: 'player1',
        players: [
          { id: 'player1', name: 'Host', isHost: true },
          { id: 'player2', name: 'Player', isHost: false }
        ],
        isPasswordProtected: false,
        maxPlayers: 6
      }
      expect(store.playerCount).toBe(2)
    })

    it('isRoomFull should return true when room is full', () => {
      const store = useRoomStore()
      store.currentRoom = {
        roomId: 'test-room',
        hostId: 'player1',
        players: Array.from({ length: 6 }, (_, i) => ({
          id: `player${i + 1}`,
          name: `Player ${i + 1}`,
          isHost: i === 0
        })),
        isPasswordProtected: false,
        maxPlayers: 6
      }
      expect(store.isRoomFull).toBe(true)
    })

    it('isRoomFull should return false when room is not full', () => {
      const store = useRoomStore()
      store.currentRoom = {
        roomId: 'test-room',
        hostId: 'player1',
        players: [{ id: 'player1', name: 'Host', isHost: true }],
        isPasswordProtected: false,
        maxPlayers: 6
      }
      expect(store.isRoomFull).toBe(false)
    })
  })

  describe('Actions', () => {
    describe('addPlayer', () => {
      it('should add player to room', () => {
        const store = useRoomStore()
        store.currentRoom = {
          roomId: 'test-room',
          hostId: 'player1',
          players: [{ id: 'player1', name: 'Host', isHost: true }],
          isPasswordProtected: false,
          maxPlayers: 6
        }

        store.addPlayer({ id: 'player2', name: 'Player 2', isHost: false })
        
        expect(store.currentRoom.players).toHaveLength(2)
        expect(store.currentRoom.players[1].id).toBe('player2')
      })

      it('should not add duplicate player', () => {
        const store = useRoomStore()
        store.currentRoom = {
          roomId: 'test-room',
          hostId: 'player1',
          players: [{ id: 'player1', name: 'Host', isHost: true }],
          isPasswordProtected: false,
          maxPlayers: 6
        }

        store.addPlayer({ id: 'player1', name: 'Host', isHost: true })
        
        expect(store.currentRoom.players).toHaveLength(1)
      })
    })

    describe('removePlayer', () => {
      it('should remove player from room', () => {
        const store = useRoomStore()
        store.currentRoom = {
          roomId: 'test-room',
          hostId: 'player1',
          players: [
            { id: 'player1', name: 'Host', isHost: true },
            { id: 'player2', name: 'Player 2', isHost: false }
          ],
          isPasswordProtected: false,
          maxPlayers: 6
        }

        store.removePlayer('player2')
        
        expect(store.currentRoom.players).toHaveLength(1)
        expect(store.currentRoom.players[0].id).toBe('player1')
      })

      it('should clear room when host leaves', () => {
        const store = useRoomStore()
        store.currentRoom = {
          roomId: 'test-room',
          hostId: 'player1',
          players: [
            { id: 'player1', name: 'Host', isHost: true },
            { id: 'player2', name: 'Player 2', isHost: false }
          ],
          isPasswordProtected: false,
          maxPlayers: 6
        }

        store.removePlayer('player1')
        
        expect(store.currentRoom).toBeNull()
      })
    })

    describe('updateRoomInfo', () => {
      it('should update room info', () => {
        const store = useRoomStore()
        const newRoomInfo: RoomInfo = {
          roomId: 'test-room',
          hostId: 'player1',
          players: [{ id: 'player1', name: 'Host', isHost: true }],
          isPasswordProtected: false,
          maxPlayers: 6
        }

        store.updateRoomInfo(newRoomInfo)
        
        expect(store.currentRoom).toEqual(newRoomInfo)
      })
    })

    describe('clearRoom', () => {
      it('should clear all room state', () => {
        const store = useRoomStore()
        store.currentRoom = {
          roomId: 'test-room',
          hostId: 'player1',
          players: [{ id: 'player1', name: 'Host', isHost: true }],
          isPasswordProtected: false,
          maxPlayers: 6
        }
        store.currentPlayerId = 'player1'
        store.currentPlayerName = 'Host'
        store.error = 'Some error'

        store.clearRoom()
        
        expect(store.currentRoom).toBeNull()
        expect(store.currentPlayerId).toBeNull()
        expect(store.currentPlayerName).toBeNull()
        expect(store.error).toBeNull()
      })
    })

    describe('generatePlayerId', () => {
      it('should generate unique player IDs', () => {
        const store = useRoomStore()
        const id1 = store.generatePlayerId()
        const id2 = store.generatePlayerId()
        
        expect(id1).toMatch(/^player_\d+_[a-z0-9]+$/)
        expect(id2).toMatch(/^player_\d+_[a-z0-9]+$/)
        expect(id1).not.toBe(id2)
      })
    })

    describe('error handling', () => {
      it('should set error message', () => {
        const store = useRoomStore()
        store.setError('Test error')
        
        expect(store.error).toBe('Test error')
      })

      it('should clear error message', () => {
        const store = useRoomStore()
        store.error = 'Test error'
        store.clearError()
        
        expect(store.error).toBeNull()
      })
    })
  })
})
