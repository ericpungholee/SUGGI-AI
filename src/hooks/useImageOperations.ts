/**
 * Image Operations Hook
 * Handles all image-related functionality for the editor
 */

import { useState, useCallback, useRef } from 'react'

export const useImageOperations = (
    editorRef: React.RefObject<HTMLDivElement>,
    saveToUndoStack: (content: string) => void
) => {
    const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null)

    // Handle image resize with drag
    const handleImageResize = useCallback((img: HTMLImageElement, width: number, height: number) => {
        // Update the image dimensions
        img.style.width = `${width}px`
        img.style.height = `${height}px`
        img.style.maxWidth = 'none'
        
        // Update the selectedImage state if it's the same image
        if (selectedImage === img) {
            setSelectedImage(img)
        }
        
        // Save to undo stack
        if (editorRef.current) {
            saveToUndoStack(editorRef.current.innerHTML)
        }
    }, [selectedImage, saveToUndoStack, editorRef])

    // Add resize handles to image
    const addResizeHandles = useCallback((img: HTMLImageElement) => {
        // Find the wrapper div (parent of the image)
        const wrapper = img.parentElement
        if (!wrapper) return
        
        // Remove existing handles
        const existingHandles = wrapper.querySelectorAll('.resize-handle')
        existingHandles?.forEach(handle => handle.remove())

        const handles = ['nw', 'ne', 'sw', 'se'] // corners
        handles.forEach(pos => {
            const handle = document.createElement('div')
            handle.className = `resize-handle resize-${pos}`
            handle.style.cssText = `
                position: absolute;
                width: 12px;
                height: 12px;
                background: #3b82f6;
                border: 2px solid white;
                cursor: ${pos.includes('n') ? 'n' : 's'}-${pos.includes('w') ? 'w' : 'e'}-resize;
                z-index: 1000;
                box-shadow: 0 0 4px rgba(0,0,0,0.3);
            `
            
            // Position the handle relative to the wrapper
            if (pos.includes('n')) handle.style.top = '-6px'
            if (pos.includes('s')) handle.style.bottom = '-6px'
            if (pos.includes('w')) handle.style.left = '-6px'
            if (pos.includes('e')) handle.style.right = '-6px'
            
            // Add drag functionality
            let startX: number, startY: number, startWidth: number, startHeight: number
            let isDragging = false
            
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault()
                e.stopPropagation()
                isDragging = true
                startX = e.clientX
                startY = e.clientY
                startWidth = img.offsetWidth
                startHeight = img.offsetHeight
                
                // Add a visual indicator that dragging has started
                handle.style.transform = 'scale(1.2)'
                
                document.addEventListener('mousemove', onMouseMove)
                document.addEventListener('mouseup', onMouseUp)
            })
            
            const onMouseMove = (e: MouseEvent) => {
                if (!isDragging) return
                
                const deltaX = e.clientX - startX
                const deltaY = e.clientY - startY
                
                let newWidth = startWidth
                let newHeight = startHeight
                
                // Calculate new dimensions based on handle position
                if (pos.includes('e')) newWidth = startWidth + deltaX
                if (pos.includes('w')) newWidth = startWidth - deltaX
                if (pos.includes('s')) newHeight = startHeight + deltaY
                if (pos.includes('n')) newHeight = startHeight - deltaY
                
                // Maintain aspect ratio (only if both dimensions are being changed)
                if (pos === 'nw' || pos === 'ne' || pos === 'sw' || pos === 'se') {
                    const aspectRatio = img.naturalWidth / img.naturalHeight
                    if (Math.abs(deltaX) > Math.abs(deltaY)) {
                        newHeight = newWidth / aspectRatio
                    } else {
                        newWidth = newHeight * aspectRatio
                    }
                }
                
                // Apply minimum size
                newWidth = Math.max(50, newWidth)
                newHeight = Math.max(50, newHeight)
                
                // Update the image dimensions immediately for smooth dragging
                img.style.width = `${newWidth}px`
                img.style.height = `${newHeight}px`
                img.style.maxWidth = 'none'
                
                // Also call the resize handler for undo stack
                handleImageResize(img, newWidth, newHeight)
            }
            
            const onMouseUp = () => {
                isDragging = false
                // Reset handle appearance
                handle.style.transform = 'scale(1)'
                document.removeEventListener('mousemove', onMouseMove)
                document.removeEventListener('mouseup', onMouseUp)
            }
            
            wrapper.appendChild(handle)
        })
    }, [handleImageResize])

    // Add crop handles to image
    const addCropHandles = useCallback((img: HTMLImageElement) => {
        // Find the wrapper div (parent of the image)
        const wrapper = img.parentElement
        if (!wrapper) return
        
        // Remove existing handles
        const existingHandles = wrapper.querySelectorAll('.crop-handle')
        existingHandles?.forEach(handle => handle.remove())

        const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] // corners and edges
        handles.forEach(pos => {
            const handle = document.createElement('div')
            handle.className = `crop-handle crop-${pos}`
            handle.style.cssText = `
                position: absolute;
                width: 8px;
                height: 8px;
                background: #ef4444;
                border: 1px solid white;
                cursor: ${pos.includes('n') ? 'n' : pos.includes('s') ? 's' : ''}${pos.includes('w') ? 'w' : pos.includes('e') ? 'e' : ''}-resize;
                z-index: 1000;
            `
            
            // Position the handle
            if (pos === 'n') handle.style.top = '-4px'
            if (pos === 's') handle.style.bottom = '-4px'
            if (pos === 'w') handle.style.left = '-4px'
            if (pos === 'e') handle.style.right = '-4px'
            if (pos === 'nw') { handle.style.top = '-4px'; handle.style.left = '-4px' }
            if (pos === 'ne') { handle.style.top = '-4px'; handle.style.right = '-4px' }
            if (pos === 'sw') { handle.style.bottom = '-4px'; handle.style.left = '-4px' }
            if (pos === 'se') { handle.style.bottom = '-4px'; handle.style.right = '-4px' }
            
            // Add drag functionality for cropping
            let startX: number, startY: number, startRect: DOMRect
            let isDragging = false
            let cropOverlay: HTMLDivElement
            
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault()
                e.stopPropagation()
                isDragging = true
                startX = e.clientX
                startY = e.clientY
                startRect = img.getBoundingClientRect()
                
                // Create crop overlay
                cropOverlay = document.createElement('div')
                cropOverlay.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.5);
                    pointer-events: none;
                    z-index: 999;
                `
                wrapper.appendChild(cropOverlay)
                
                document.addEventListener('mousemove', onMouseMove)
                document.addEventListener('mouseup', onMouseUp)
            })
            
            const onMouseMove = (e: MouseEvent) => {
                if (!isDragging) return
                
                const deltaX = e.clientX - startX
                const deltaY = e.clientY - startY
                
                // Calculate crop area based on handle position
                let cropX = 0, cropY = 0, cropWidth = img.naturalWidth, cropHeight = img.naturalHeight
                
                if (pos.includes('e')) cropWidth = startRect.width - deltaX
                if (pos.includes('w')) { cropX = deltaX; cropWidth = startRect.width - deltaX }
                if (pos.includes('s')) cropHeight = startRect.height - deltaY
                if (pos.includes('n')) { cropY = deltaY; cropHeight = startRect.height - deltaY }
                
                // Apply minimum size
                cropWidth = Math.max(50, cropWidth)
                cropHeight = Math.max(50, cropHeight)
                
                // Update crop overlay
                if (cropOverlay) {
                    cropOverlay.style.clipPath = `inset(${cropY}px ${startRect.width - cropX - cropWidth}px ${startRect.height - cropY - cropHeight}px ${cropX}px)`
                }
            }
            
            const onMouseUp = () => {
                if (isDragging && cropOverlay) {
                    // Apply the crop
                    const rect = img.getBoundingClientRect()
                    const scaleX = img.naturalWidth / rect.width
                    const scaleY = img.naturalHeight / rect.height
                    
                    const cropData = {
                        x: 0,
                        y: 0,
                        width: img.naturalWidth,
                        height: img.naturalHeight
                    }
                    
                    // Calculate actual crop coordinates
                    if (pos.includes('e')) cropData.width = Math.max(50, img.naturalWidth - (startX - rect.left) * scaleX)
                    if (pos.includes('w')) { cropData.x = (startX - rect.left) * scaleX; cropData.width = Math.max(50, img.naturalWidth - cropData.x) }
                    if (pos.includes('s')) cropData.height = Math.max(50, img.naturalHeight - (startY - rect.top) * scaleY)
                    if (pos.includes('n')) { cropData.y = (startY - rect.top) * scaleY; cropData.height = Math.max(50, img.naturalHeight - cropData.y) }
                    
                    handleImageCrop(cropData)
                }
                
                isDragging = false
                if (cropOverlay) cropOverlay.remove()
                document.removeEventListener('mousemove', onMouseMove)
                document.removeEventListener('mouseup', onMouseUp)
            }
            
            wrapper.appendChild(handle)
        })
    }, [])

    // Handle image crop
    const handleImageCrop = useCallback((cropData: { x: number; y: number; width: number; height: number }) => {
        if (selectedImage) {
            // Create a canvas to crop the image
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            if (ctx) {
                canvas.width = cropData.width
                canvas.height = cropData.height
                
                // Draw the cropped portion
                ctx.drawImage(
                    selectedImage,
                    cropData.x, cropData.y, cropData.width, cropData.height,
                    0, 0, cropData.width, cropData.height
                )
                
                // Replace the image with cropped version
                const newImg = document.createElement('img')
                newImg.src = canvas.toDataURL()
                newImg.style.width = `${cropData.width}px`
                newImg.style.height = `${cropData.height}px`
                newImg.className = 'editor-image'
                
                selectedImage.parentNode?.replaceChild(newImg, selectedImage)
                
                // Save to undo stack
                if (editorRef.current) {
                    saveToUndoStack(editorRef.current.innerHTML)
                }
            }
        }
    }, [selectedImage, saveToUndoStack, editorRef])

    // Handle image selection
    const handleImageClick = useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement
        
        if (target.tagName === 'IMG') {
            e.preventDefault()
            e.stopPropagation()
            
            // Remove previous selection styling and handles
            const prevSelected = document.querySelector('.editor-image.selected')
            if (prevSelected) {
                prevSelected.classList.remove('selected')
                const existingHandles = prevSelected.parentElement?.querySelectorAll('.resize-handle, .crop-handle')
                existingHandles?.forEach(handle => handle.remove())
            }
            
            // Add selection styling to current image
            target.classList.add('selected')
            
            setSelectedImage(target as HTMLImageElement)
            
            // Show resize handles by default
            addResizeHandles(target as HTMLImageElement)
        } else {
            // Clicked on non-image, deselect current image
            const prevSelected = document.querySelector('.editor-image.selected')
            if (prevSelected) {
                prevSelected.classList.remove('selected')
                const existingHandles = prevSelected.parentElement?.querySelectorAll('.resize-handle, .crop-handle')
                existingHandles?.forEach(handle => handle.remove())
            }
            setSelectedImage(null)
        }
    }, [addResizeHandles])
    
    // Handle right-click on image to toggle between resize and crop handles
    const handleImageRightClick = useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement
        if (target.tagName === 'IMG' && selectedImage === target) {
            e.preventDefault()
            e.stopPropagation()
            
            const currentHandles = target.parentElement?.querySelectorAll('.resize-handle, .crop-handle')
            const hasResizeHandles = target.parentElement?.querySelector('.resize-handle')
            
            // Remove current handles
            currentHandles?.forEach(handle => handle.remove())
            
            // Toggle between resize and crop
            if (hasResizeHandles) {
                addCropHandles(target as HTMLImageElement)
            } else {
                addResizeHandles(target as HTMLImageElement)
            }
        }
    }, [selectedImage, addResizeHandles, addCropHandles])

    // Insert image from file
    const insertImageFromFile = useCallback((file: File) => {
        const reader = new FileReader()
        reader.onload = (event) => {
            const img = document.createElement('img')
            img.src = event.target?.result as string
            img.style.maxWidth = '100%'
            img.style.height = 'auto'
            img.className = 'editor-image'
            img.style.position = 'relative'
            img.style.display = 'inline-block'
            
            // Create a wrapper div with relative positioning for the handles
            const wrapper = document.createElement('div')
            wrapper.style.position = 'relative'
            wrapper.style.display = 'inline-block'
            wrapper.appendChild(img)
            
            // Insert the wrapper at cursor position
            const selection = window.getSelection()
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0)
                range.deleteContents()
                range.insertNode(wrapper)
                range.setStartAfter(wrapper)
                range.setEndAfter(wrapper)
                selection.removeAllRanges()
                selection.addRange(range)
                
                // Save to undo stack
                if (editorRef.current) {
                    saveToUndoStack(editorRef.current.innerHTML)
                }
            }
        }
        reader.readAsDataURL(file)
    }, [saveToUndoStack, editorRef])

    return {
        selectedImage,
        setSelectedImage,
        handleImageClick,
        handleImageRightClick,
        insertImageFromFile,
        addResizeHandles,
        addCropHandles
    }
}