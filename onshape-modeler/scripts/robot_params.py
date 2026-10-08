"""Shared layout parameters for the competition-robot subsystem scripts (inches).
Robot frame: X lateral (+right), Y forward, Z up, origin = centre of the frame at floor level.
Everything here is a PROPOSAL for the team to confirm; values marked PLACEHOLDER are unverified vendor sizes."""

# ---- frame (S1)
HX = HY = 13.5                      # 27 x 27 in perimeter (R104 limit: 110 in total)
TUBE_W, TUBE_H, TUBE_WALL = 1.0, 2.0, 0.0625
TUBE_Z0 = 2.5                       # tube inside the 2.5-5.75 in bumper zone
TUBE_Z1 = TUBE_Z0 + TUBE_H
PAN_T, PAN_Z0 = 0.125, TUBE_Z1      # 1/8 in 6061 pan on top of the tubes
PAN_HALF = 13.25
MODULE_KEEPOUT = 5.5                # square keep-out at each corner (swerve module not chosen yet) PLACEHOLDER
MODULE_Z = (0.0, 6.0)               # PLACEHOLDER module height envelope

# ---- zones
ELEC_Y_MAX = -5.5                   # electronics/battery zone y in [-13.5, -5.5]; mechanism bay y >= -5.5

# ---- battery (S2)  VERIFIED size (R601): 7.1 x 3.0 x 6.6 in, 11-14.5 lb. Standing, terminals up, lift out through the top.
BATT = {"x": (-3.55, 3.55), "y": (-9.5, -6.5), "z": (PAN_Z0 + PAN_T + 0.125, PAN_Z0 + PAN_T + 0.125 + 6.6), "lb": 12.5}
TRAY_BASE_T = 0.125
TRAY_BASE = {"x": (-4.05, 4.05), "y": (-10.0, -6.0)}

# ---- rear electronics panel (S3): vertical, above the bumper top (7.5 in), accessible/visible from behind
PANEL = {"x": (-12.0, 12.0), "z": (8.0, 14.5), "y": (-13.0, -12.75)}      # 1/4 in polycarbonate, electrically isolating (R611), inside the perimeter
UPRIGHT_X = [-7.0, -2.5, 2.5, 7.0]            # 4 aluminium upright plates (1/8 in) in front of the panel; foot bolted to the pan, top bolted through the panel
UPRIGHT_Z_TOP = 8.6
PDH = {"x": (-4.4, 4.475), "z": (8.8, 13.175), "y_thick": 1.563, "lb": 1.14}           # VERIFIED size (REV-11-1850)
RIO = {"x": (-11.9, -6.5), "z": (8.6, 14.0), "y_thick": 1.6, "lb": 1.2}                # PLACEHOLDER size (unverified)
RADIO = {"x": (6.4, 9.9), "z": (11.8, 14.3), "y_thick": 1.0, "lb": 0.4}                # PLACEHOLDER
BREAKER = {"x": (9.0, 11.8), "z": (8.7, 10.5), "y_thick": 1.2, "lb": 0.5}              # PLACEHOLDER, mounted through a window, handle toward the rear

# ---- module centres (corner), for cable routing
MOD = [(-10.0, -10.0), (10.0, -10.0), (-10.0, 10.0), (10.0, 10.0)]

# ---- assumed masses (lb) used for CG; modules and bay content are ASSUMPTIONS
MASS = {"modules x4 (ASSUMED 7.0 each)": 28.0, "mechanism bay content (ASSUMED, intake+scoring)": 25.0, "bumpers (S5 computed + assumed cover/hardware)": 12.6}
