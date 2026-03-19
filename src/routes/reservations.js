import { Router } from 'express';
import { supabase } from '../services/supabase.js';
import { validateReservation } from '../middleware/validation.js';
import { parseMinutes, calculatePrice } from '../utils/helpers.js';

const router = Router();

// Error messages (Korean)
const ERROR_MESSAGES = {
  DB_INSERT_FAILED: '예약 등록에 실패했습니다. 잠시 후 다시 시도해주세요.',
  INVALID_TIME_RANGE: '종료 시간은 시작 시간보다 늦어야 합니다.',
};

router.post('/', validateReservation, async (req, res, next) => {
  try {
    const {
      venueType, name, organization, phone, rentalDate, startTime, endTime,
      numPerformers, description, referralSources, referralOther, options,
      signatureData, termsAgreed
    } = req.body;

    const rentalHours = (parseMinutes(endTime) - parseMinutes(startTime)) / 60;
    const additionalPrice = calculatePrice(options || {});

    const insertData = {
      venue_type: venueType,
      name: name.trim(),
      organization: organization?.trim() || null,
      phone: phone.replace(/[-\s]/g, ''),
      rental_date: rentalDate,
      start_time: startTime,
      end_time: endTime,
      rental_hours: rentalHours,
      num_performers: numPerformers,
      description: description?.trim() || null,
      referral_sources: referralSources || [],
      referral_other: referralOther?.trim() || null,
      opt_extra_capacity: options?.extraCapacity || false,
      opt_multitrack: options?.multitrack || false,
      opt_personal_monitor: options?.personalMonitor || false,
      opt_extra_operator: options?.extraOperator || false,
      opt_extra_operator_hours: options?.extraOperatorHours || 0,
      opt_bar_operation: options?.barOperation || false,
      opt_prompter: options?.prompter || false,
      opt_tax_invoice: options?.taxInvoice || false,
      additional_price: additionalPrice,
      total_price: additionalPrice,
      signature_data: signatureData || null,
      terms_agreed: termsAgreed || false,
      terms_agreed_at: termsAgreed ? new Date().toISOString() : null,
    };

    // Validate time range
    if (parseMinutes(endTime) <= parseMinutes(startTime)) {
      return res.status(400).json({
        success: false,
        errors: [ERROR_MESSAGES.INVALID_TIME_RANGE],
      });
    }

    const { data, error } = await supabase
      .from('reservations')
      .insert(insertData)
      .select('id, total_price, submitted_at')
      .single();

    if (error) {
      console.error('[Reservation Error]', error.code, error.message);
      return res.status(500).json({
        success: false,
        errors: [ERROR_MESSAGES.DB_INSERT_FAILED],
      });
    }

    res.status(201).json({
      success: true,
      data,
      message: '예약 신청이 완료되었습니다.',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
