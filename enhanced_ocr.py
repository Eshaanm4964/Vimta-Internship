#!/usr/bin/env python3
"""
Enhanced OCR Extraction System for VIMTA Labs Machine Reading System
This module provides improved OCR extraction with better preprocessing and pattern recognition.
"""

import cv2
import numpy as np
import re
import json
import logging
from typing import Dict, List, Optional, Tuple, Any
from PIL import Image, ImageDraw, ImageFont
import base64
import io

try:
    from paddleocr import PaddleOCR
    PADDLE_AVAILABLE = True
except ImportError:
    PADDLE_AVAILABLE = False
    logging.warning("PaddleOCR not available. Install with: pip install paddlepaddle paddleocr")

class EnhancedOCRExtractor:
    """
    Enhanced OCR extraction with improved preprocessing and pattern recognition
    specifically designed for machine display reading.
    """
    
    def __init__(self, use_gpu: bool = False, lang: str = 'en'):
        self.logger = logging.getLogger(__name__)
        self.use_gpu = use_gpu
        self.lang = lang
        self.ocr = None
        
        if PADDLE_AVAILABLE:
            try:
                self.ocr = PaddleOCR(use_angle_cls=True, lang=lang, use_gpu=use_gpu)
                self.logger.info("Enhanced OCR initialized successfully")
            except Exception as e:
                self.logger.error(f"Failed to initialize PaddleOCR: {e}")
                raise
        else:
            raise ImportError("PaddleOCR is required for OCR functionality")
    
    def preprocess_image(self, image: np.ndarray) -> List[np.ndarray]:
        """
        Enhanced image preprocessing with multiple techniques for better OCR accuracy.
        """
        processed_images = []
        
        try:
            # Convert to grayscale
            if len(image.shape) == 3:
                gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            else:
                gray = image.copy()
            
            # 1. Original grayscale
            processed_images.append(gray)
            
            # 2. Adaptive threshold (better for varying lighting)
            adaptive = cv2.adaptiveThreshold(
                gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                cv2.THRESH_BINARY, 11, 2
            )
            processed_images.append(adaptive)
            
            # 3. Otsu threshold (good for high contrast)
            _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            processed_images.append(otsu)
            
            # 4. Denoised version
            denoised = cv2.fastNlMeansDenoising(gray, h=10, templateWindowSize=7, searchWindowSize=21)
            _, denoised_thresh = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            processed_images.append(denoised_thresh)
            
            # 5. Contrast enhanced
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
            enhanced = clahe.apply(gray)
            _, enhanced_thresh = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            processed_images.append(enhanced_thresh)
            
            # 6. Inverted (for light text on dark background)
            inverted = cv2.bitwise_not(gray)
            _, inverted_thresh = cv2.threshold(inverted, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            processed_images.append(inverted_thresh)
            
        except Exception as e:
            self.logger.error(f"Error in preprocessing: {e}")
            # Fallback to original image
            processed_images = [gray if len(image.shape) == 3 else image]
        
        return processed_images
    
    def extract_text_with_confidence(self, image: np.ndarray, confidence_threshold: float = 0.8) -> List[Dict]:
        """
        Extract text with confidence filtering.
        """
        all_results = []
        
        # Try multiple preprocessing methods
        processed_images = self.preprocess_image(image)
        
        for i, processed_img in enumerate(processed_images):
            try:
                result = self.ocr.ocr(processed_img, cls=True)
                
                if result and result[0]:
                    for line in result[0]:
                        bbox, (text, confidence) = line
                        
                        # Filter by confidence
                        if confidence >= confidence_threshold:
                            all_results.append({
                                'text': text.strip(),
                                'confidence': confidence,
                                'bbox': bbox,
                                'preprocessing_method': i
                            })
                
            except Exception as e:
                self.logger.warning(f"OCR failed on preprocessing method {i}: {e}")
                continue
        
        # Remove duplicates and sort by confidence
        unique_results = {}
        for item in all_results:
            text = item['text'].lower().strip()
            if text not in unique_results or item['confidence'] > unique_results[text]['confidence']:
                unique_results[text] = item
        
        # Sort by confidence descending
        sorted_results = sorted(unique_results.values(), key=lambda x: x['confidence'], reverse=True)
        
        # Deduplicate overlapping boxes (keep higher confidence)
        final_results = []
        for res in sorted_results:
            is_overlap = False
            for existing in final_results:
                # Check for significant overlap (if box is mostly inside another)
                if self._calculate_overlap_ratio(res['bbox'], existing['bbox']) > 0.6:
                    is_overlap = True
                    break
            if not is_overlap:
                final_results.append(res)
        
        return final_results

    def _calculate_overlap_ratio(self, bbox1: List, bbox2: List) -> float:
        """Calculate how much of the smaller box overlaps with the larger one"""
        try:
            def get_coords(bbox):
                xs = [p[0] for p in bbox]
                ys = [p[1] for p in bbox]
                return min(xs), min(ys), max(xs), max(ys)
            
            ax1, ay1, ax2, ay2 = get_coords(bbox1)
            bx1, by1, bx2, by2 = get_coords(bbox2)
            
            inter_x1 = max(ax1, bx1)
            inter_y1 = max(ay1, by1)
            inter_x2 = min(ax2, bx2)
            inter_y2 = min(ay2, by2)
            
            if inter_x2 <= inter_x1 or inter_y2 <= inter_y1:
                return 0.0
            
            inter_area = (inter_x2 - inter_x1) * (inter_y2 - inter_y1)
            area1 = (ax2 - ax1) * (ay2 - ay1)
            area2 = (bx2 - bx1) * (by2 - by1)
            
            # Intersection over minimum area (good for containment check)
            return inter_area / float(min(area1, area2))
        except:
            return 0.0
    
    def extract_machine_values(self, image: np.ndarray, machine_config: Dict) -> Dict:
        """
        Extract machine-specific values using improved pattern recognition.
        """
        try:
            # Extract all text with high confidence
            text_results = self.extract_text_with_confidence(image, confidence_threshold=0.7)
            
            if not text_results:
                self.logger.warning("No text extracted with sufficient confidence")
                return {'success': False, 'error': 'No text extracted'}
            
            # Sort results spatially (left to right, then top to bottom)
            # This is crucial for correctly identifying fields by position
            text_results.sort(key=lambda x: (x['bbox'][0][1] // 10, x['bbox'][0][0]))
            
            # Combine all text for pattern matching
            all_text = ' '.join([item['text'] for item in text_results])
            self.logger.info(f"Extracted and sorted text: {all_text}")
            
            # Extract values based on machine configuration
            extracted_values = {}
            fields = machine_config.get('fields', [])
            units = machine_config.get('units', {})
            
            # Enhanced pattern definitions based on centrifuge display analysis
            patterns = {
                'speed': [
                    r'\b(\d{3,5})\b',
                    r'\b0\b',
                    r'(?:speed|s)[:\s]*(\d+(?:\.\d+)?)\s*(?:rpm)?',
                    r'(\d+(?:\.\d+)?)\s*rpm'
                ],
                'temperature': [
                    r'\b(-?\d{1,3}(?:\.\d+)?)\b',
                    r'(?:temp|temperature|t)[:\s]*(-?\d+(?:\.\d+)?)\s*°?[cf]?',
                    r'(-?\d+(?:\.\d+)?)\s*°?[cf]'
                ],
                'time_value': [
                    r'(\d{1,2}:\d{2}(?::\d{2})?)',
                    r'(?:time|t)[:\s]*(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:min|minutes)?'
                ],
                'osmolarity': [
                    r'\b(\d{1,4})\b',
                    r'(?:osm|osmolarity)[:\s]*(\d+(?:\.\d+)?)\s*(?:mosm|mosm/kg)?',
                    r'(\d+(?:\.\d+)?)\s*(?:mosm|mosm/kg)',
                    r'osm[:\s]*(\d+(?:\.\d+)?)'
                ],
                'absorbance': [
                    r'\b(\d\.\d{1,4})\b',
                    r'(?:abs|absorbance)[:\s]*(\d+(?:\.\d+)?)',
                    r'(\d+\.\d+)\s*abs',
                    r'abs[:\s]*(\d+(?:\.\d+)?)'
                ],
                'wavelength': [
                    r'\b(\d{3})\b',
                    r'(?:wave|wavelength|λ)[:\s]*(\d+(?:\.\d+)?)\s*(?:nm)?',
                    r'(\d+(?:\.\d+)?)\s*(?:nm)',
                    r'wave[:\s]*(\d+(?:\.\d+)?)'
                ],
                'pressure': [
                    r'\b(\d+(?:\.\d+)?)\b',
                    r'(?:press|pressure|p)[:\s]*(\d+(?:\.\d+)?)\s*(?:bar|psi)?',
                    r'(\d+(?:\.\d+)?)\s*(?:bar|psi)',
                    r'press[:\s]*(\d+(?:\.\d+)?)'
                ],
                'co2': [
                    r'\b(\d+(?:\.\d+)?)\b',
                    r'(?:co2|co₂|carbon)[:\s]*(\d+(?:\.\d+)?)\s*%?',
                    r'(\d+(?:\.\d+)?)\s*%?\s*(?:co2|co₂)',
                    r'co2[:\s]*(\d+(?:\.\d+)?)'
                ],
                'frequency': [
                    r'\b(\d+(?:\.\d+)?)\b',
                    r'(?:freq|frequency|f)[:\s]*(\d+(?:\.\d+)?)\s*(?:hz|khz)?',
                    r'(\d+(?:\.\d+)?)\s*(?:hz|khz)',
                    r'freq[:\s]*(\d+(?:\.\d+)?)'
                ],
                'power': [
                    r'\b(\d+(?:\.\d+)?)\b',
                    r'(?:power|p)[:\s]*(\d+(?:\.\d+)?)\s*(?:%|w)?',
                    r'(\d+(?:\.\d+)?)\s*(?:%|w)\s*(?:power)?',
                    r'power[:\s]*(\d+(?:\.\d+)?)'
                ],
                'weight': [
                    r'\b(\d+(?:\.\d+)?)\b',
                    r'(?:weight|w|wt)[:\s]*(\d+(?:\.\d+)?)\s*(?:g|kg|mg)?',
                    r'(\d+(?:\.\d+)?)\s*(?:g|kg|mg)',
                    r'weight[:\s]*(\d+(?:\.\d+)?)'
                ],
                'volume': [
                    r'\b(\d+(?:\.\d+)?)\b',
                    r'(?:vol|volume|v)[:\s]*(\d+(?:\.\d+)?)\s*(?:ml|l|µl)?',
                    r'(\d+(?:\.\d+)?)\s*(?:ml|l|µl)',
                    r'vol[:\s]*(\d+(?:\.\d+)?)'
                ]
            }
            
            # Extra logic for specific machine types like centrifuge
            machine_type = machine_config.get('machine_type')
            
            if machine_type == 'centrifuge' or machine_type == 'thermomixer':
                # Centrifuges usually follow [SPEED] [TIME] [TEMP] order from left to right
                # Let's try to extract all numbers and assign them based on position and value
                
                # Extract all numbers from sorted fragments
                all_numbers = []
                for item in text_results:
                    text = item['text']
                    
                    # 1. First, find all time patterns and their positions
                    times = []
                    for m in re.finditer(r'(\d{1,2}:\d{2}(?::\d{2})?)', text):
                        times.append({
                            'type': 'time', 
                            'value': m.group(1), 
                            'start': m.start(), 
                            'end': m.end(),
                            'x': item['bbox'][0][0] + (m.start() / len(text)) * (item['bbox'][1][0] - item['bbox'][0][0])
                        })
                    
                    # 2. Replace times with spaces to extract remaining numbers
                    temp_text = text
                    for t in times:
                        temp_text = temp_text[:t['start']] + ' ' * (t['end'] - t['start']) + temp_text[t['end']:]
                    
                    # 3. Find remaining numbers (integers and floats)
                    nums = []
                    # Use a pattern that looks for numbers possibly preceded by a minus sign
                    # and not immediately preceded by another digit
                    for m in re.finditer(r'(?<!\d)(-?\d+(?:\.\d+)?)', temp_text):
                        nums.append({
                            'type': 'number', 
                            'value': float(m.group(1)), 
                            'start': m.start(), 
                            'end': m.end(),
                            'x': item['bbox'][0][0] + (m.start() / len(text)) * (item['bbox'][1][0] - item['bbox'][0][0])
                        })
                    
                    all_numbers.extend(times)
                    all_numbers.extend(nums)
                
                # If we have numbers, try to assign them intelligently
                if all_numbers:
                    # Sort by x coordinate
                    all_numbers.sort(key=lambda x: x['x'])
                    
                    # Find time first as an anchor
                    time_idx = -1
                    for i, num in enumerate(all_numbers):
                        if num['type'] == 'time' and extracted_values.get('time_value') is None:
                            extracted_values['time_value'] = num['value']
                            time_idx = i
                            break
                    
                    # Numbers to the left of time are Speed
                    # Numbers to the right of time are Temperature
                    for i, num in enumerate(all_numbers):
                        if num['type'] == 'number':
                            val = num['value']
                            if time_idx == -1:
                                # No time anchor, use heuristics
                                if (val >= 100 or val == 0) and extracted_values.get('speed') is None:
                                    extracted_values['speed'] = val
                                elif -20 <= val <= 100 and extracted_values.get('temperature') is None:
                                    extracted_values['temperature'] = val
                            elif i < time_idx:
                                if extracted_values.get('speed') is None:
                                    extracted_values['speed'] = val
                            else:
                                if extracted_values.get('temperature') is None:
                                    extracted_values['temperature'] = val
            
            # General extraction for any remaining fields
            for field in fields:
                if extracted_values.get(field) is not None:
                    continue
                    
                if field in patterns:
                    field_patterns = patterns[field]
                    
                    for pattern in field_patterns:
                        match = re.search(pattern, all_text, re.IGNORECASE)
                        if match:
                            value = match.group(1)
                            
                            # Convert to appropriate type
                            if field == 'time_value':
                                extracted_values[field] = value
                            else:
                                try:
                                    extracted_values[field] = float(value)
                                except ValueError:
                                    extracted_values[field] = value
                            
                            self.logger.info(f"Extracted {field} via fallback: {extracted_values[field]}")
                            break
            
            # Add metadata
            extracted_values['_metadata'] = {
                'extracted_text': all_text,
                'text_results': text_results,
                'machine_config': machine_config,
                'confidence_scores': [item['confidence'] for item in text_results]
            }
            
            return {
                'success': True,
                'values': extracted_values,
                'confidence': np.mean([item['confidence'] for item in text_results]) if text_results else 0.0
            }
            
        except Exception as e:
            self.logger.error(f"Error in machine value extraction: {e}")
            return {'success': False, 'error': str(e)}

def create_enhanced_ocr_extractor(use_gpu: bool = False, lang: str = 'en') -> EnhancedOCRExtractor:
    """
    Factory function to create enhanced OCR extractor.
    """
    return EnhancedOCRExtractor(use_gpu=use_gpu, lang=lang)

# Global instance for backward compatibility
_enhanced_ocr_instance = None

def get_enhanced_ocr_extractor() -> EnhancedOCRExtractor:
    """
    Get or create global enhanced OCR extractor instance.
    """
    global _enhanced_ocr_instance
    if _enhanced_ocr_instance is None:
        _enhanced_ocr_instance = create_enhanced_ocr_extractor()
    return _enhanced_ocr_instance

def extract_values_enhanced(image_path: str, machine_config: Dict) -> Dict:
    """
    Enhanced value extraction function.
    """
    try:
        # Read image
        image = cv2.imread(image_path)
        if image is None:
            return {'success': False, 'error': 'Could not read image'}
        
        # Get OCR extractor
        extractor = get_enhanced_ocr_extractor()
        
        # Extract values
        result = extractor.extract_machine_values(image, machine_config)
        
        return result
        
    except Exception as e:
        logging.error(f"Error in enhanced extraction: {e}")
        return {'success': False, 'error': str(e)}
