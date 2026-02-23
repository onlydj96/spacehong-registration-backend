import { Router } from 'express';
import { supabase } from '../services/supabase.js';
import { validateReservation } from '../middleware/validation.js';
import { parseMinutes, calculatePrice } from '../utils/helpers.js';

const router = Router();

router.post('/', validateReservation, async (req, res, next) => {
  try {
    const {
      name, organization, phone, rentalDate, startTime, endTime,
      numPerformers, description, referralSources, options
    } = req.body;

    const rentalHours = (parseMinutes(endTime) - parseMinutes(startTime)) / 60;
    const additionalPrice = calculatePrice(options || {});

    const insertData = {
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
    };

    const { data, error } = await supabase
      .from('reservations')
      .insert(insertData)
      .select('id, total_price, submitted_at')
      .single();

    if (error) throw error;

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
