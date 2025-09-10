import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Store active operations for cancellation
const activeOperations = new Map<string, AbortController>()

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { operationId } = body

    if (!operationId) {
      return NextResponse.json({ error: 'Operation ID is required' }, { status: 400 })
    }

    // Cancel the operation
    const controller = activeOperations.get(operationId)
    if (controller) {
      controller.abort()
      activeOperations.delete(operationId)
      
      return NextResponse.json({
        success: true,
        message: 'Operation cancelled successfully'
      })
    } else {
      return NextResponse.json({
        success: false,
        message: 'Operation not found or already completed'
      })
    }
  } catch (error) {
    console.error('Error cancelling operation:', error)
    return NextResponse.json(
      { error: 'Failed to cancel operation' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const operationId = searchParams.get('operationId')

    if (!operationId) {
      return NextResponse.json({ error: 'Operation ID is required' }, { status: 400 })
    }

    // Check if operation is still active
    const isActive = activeOperations.has(operationId)
    
    return NextResponse.json({
      success: true,
      isActive
    })
  } catch (error) {
    console.error('Error checking operation status:', error)
    return NextResponse.json(
      { error: 'Failed to check operation status' },
      { status: 500 }
    )
  }
}

// Helper function to register an operation
export function registerOperation(operationId: string, controller: AbortController) {
  activeOperations.set(operationId, controller)
  
  // Clean up after 5 minutes
  setTimeout(() => {
    activeOperations.delete(operationId)
  }, 5 * 60 * 1000)
}

// Helper function to unregister an operation
export function unregisterOperation(operationId: string) {
  activeOperations.delete(operationId)
}
