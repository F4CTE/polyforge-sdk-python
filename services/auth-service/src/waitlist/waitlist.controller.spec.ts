import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WaitlistController } from './waitlist.controller';
import { WaitlistService } from './waitlist.service';

describe('WaitlistController', () => {
    let controller: WaitlistController;
    let waitlist: WaitlistService;

    beforeEach(() => {
        waitlist = {
            join: vi.fn().mockResolvedValue({ joined: true }),
        } as unknown as WaitlistService;
        controller = new WaitlistController(waitlist);
    });

    describe('POST /waitlist', () => {
        it('delegates to waitlist.join and returns the result', async () => {
            const dto = { email: 'test@example.com' };
            const result = await controller.join(dto);
            expect(result).toEqual({ joined: true });
            expect(waitlist.join).toHaveBeenCalledWith(dto);
        });
    });
});
